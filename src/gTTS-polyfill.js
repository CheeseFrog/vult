(function() {
	const nativeSynth = window.speechSynthesis;
	
	async function detectLanguage(text) {
		const url = "https://translate.googleapis.com/translate_a/single" +
			"?client=gtx" +
			"&sl=auto" +
			"&tl=en" +
			"&dt=t" +
			`&q=${encodeURIComponent(text)}`;
			
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = await response.json();
		return {
			language: data[2] || null,
			probability: data[6] !== undefined ? Number(data[6]) : 0,
			raw: data
		};
	}
	
	const customLocales = ['en', 'en-US', 'en-GB', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'pt','ru', 'zh'];
	const Languages = ['English', 'English', 'English', 'Arabic', 'German', 'Spanish', 'French', 'Hindi', 'Japanese', 'Portuguese', 'Russian', 'Chinese'];
	
	const googleVoices = customLocales.map(lang => ({
		default: false,
		lang: "[web]",
		localService: false,
		name: `Google TTS - ${Languages[customLocales.indexOf(lang)]} (${lang})`,
		voiceURI: `Google Translate TTS (${lang})`,
		_lang: lang,
		_isGoogleTTS: true
	}));
	
	googleVoices.unshift({
		default: true,
		lang: "[web]",
		localService: false,
		name: "Google TTS - Auto Detect",
		voiceURI: "Google Translate TTS (auto)",
		_lang: "auto",
		_isGoogleTTS: true
	});

	if (!window.SpeechSynthesisUtterance) {
		window.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
			constructor(text = "") {
				this.text = text;
				this.lang = "auto";
				this.volume = 1;
				this.rate = 1;
				this.pitch = 1;
				this.voice = null;
				this.onstart = null;
				this.onend = null;
				this.onerror = null;
				this.onpause = null;
				this.onresume = null;
				this.onmark = null;
				this.onboundary = null;
			}
		};
	} else {
		const originalVoiceDescriptor = Object.getOwnPropertyDescriptor(window.SpeechSynthesisUtterance.prototype, 'voice');
		
		if (originalVoiceDescriptor) {
			Object.defineProperty(window.SpeechSynthesisUtterance.prototype, 'voice', {
				set: function(val) {
					if (val && val._isGoogleTTS) {
						this.__customVoice = val;
					} else {
						this.__customVoice = null;
						if (originalVoiceDescriptor.set) {
							originalVoiceDescriptor.set.call(this, val);
						}
					}
				},
				get: function() {
					if (this.__customVoice) {
						return this.__customVoice;
					}
					if (originalVoiceDescriptor.get) {
						return originalVoiceDescriptor.get.call(this);
					}
					return null;
				},
				configurable: true,
				enumerable: true
			});
		}
	}

	class HybridSpeechSynthesis {
		constructor() {
			this.googleQueue = [];
			this.googleSpeaking = false;
			this.googlePaused = false;
			this.isDetectingLang = false;
			this.currentUtterance = null;
			
			this.sequenceDominantLang = null;
			this.sequenceDominantProb = 0;
			this.lastSequenceEndTime = 0;
			
			this.proxyFn = null;
			
			// Single persistent audio element to bypass strict autoplay policies
			this.audioElement = new Audio();
			
			this.audioElement.onplay = () => {
				if (this.currentUtterance && this.currentUtterance.onstart) {
					this.currentUtterance.onstart(new Event('start'));
				}
			};

			this.audioElement.onended = () => {
				const currUtt = this.currentUtterance;
				this.currentUtterance = null;
				
				this.lastSequenceEndTime = Date.now();
				setTimeout(() => this._processGoogleQueue(), 0);
				
				if (currUtt && currUtt.onend) {
					currUtt.onend(new Event('end'));
				}
			};

			this.audioElement.onerror = (e) => {
				const currUtt = this.currentUtterance;
				this.currentUtterance = null;
				
				this.lastSequenceEndTime = Date.now();
				setTimeout(() => this._processGoogleQueue(), 0);
				
				if (currUtt && currUtt.onerror) {
					currUtt.onerror(e);
				}
			};
			
			this.onvoiceschanged = null;
			if (nativeSynth) {
				nativeSynth.onvoiceschanged = (e) => {
					if (this.onvoiceschanged) {
						this.onvoiceschanged(e);
					}
				};
			}
		}

		setProxy(fn) {
			if (typeof fn === 'function') {
				this.proxyFn = fn;
			}
		}

		get speaking() {
			const nativeSpeaking = nativeSynth ? nativeSynth.speaking : false;
			return nativeSpeaking || this.googleSpeaking || this.isDetectingLang;
		}

		get paused() {
			const nativePaused = nativeSynth ? nativeSynth.paused : false;
			return nativePaused || this.googlePaused;
		}

		get pending() {
			const nativePending = nativeSynth ? nativeSynth.pending : false;
			return nativePending || this.googleQueue.length > 0;
		}

		getVoices() {
			const nativeVoices = nativeSynth ? nativeSynth.getVoices() : [];
			if (!nativeVoices.find(v => v._isGoogleTTS)) {
				return [...googleVoices, ...nativeVoices];
			}
			return nativeVoices;
		}

		speak(utterance) {
			utterance._queuedAt = Date.now();
			
			const isCustomVoice = utterance.voice && utterance.voice._isGoogleTTS;
			
			if (isCustomVoice || !nativeSynth) {
				this.googleQueue.push(utterance);
				if (!this.googleSpeaking && !this.googlePaused && !this.isDetectingLang) {
					this._processGoogleQueue();
				}
			} else if (nativeSynth) {
				nativeSynth.speak(utterance);
			}
		}

		cancel() {
			if (nativeSynth) {
				nativeSynth.cancel();
			}

			const wasActive = this.googleSpeaking || this.isDetectingLang || this.currentUtterance !== null;

			this.audioElement.pause();
			this.audioElement.removeAttribute('src');
			this.audioElement.load();
			
			this.googleQueue = [];
			this.googleSpeaking = false;
			this.googlePaused = false;
			this.isDetectingLang = false;
			this.currentUtterance = null;
			
			if (wasActive) {
				this.lastSequenceEndTime = Date.now();
			}
		}

		pause() {
			if (nativeSynth) {
				nativeSynth.pause();
			}

			if (this.currentUtterance && !this.googlePaused) {
				this.audioElement.pause();
				this.googlePaused = true;
				if (this.currentUtterance.onpause) {
					this.currentUtterance.onpause(new Event('pause'));
				}
			}
		}

		resume() {
			if (nativeSynth) {
				nativeSynth.resume();
			}

			if (this.currentUtterance && this.googlePaused) {
				const playPromise = this.audioElement.play();
				
				if (playPromise !== undefined) {
					playPromise.catch(e => {
						if (e.name !== 'AbortError' && this.currentUtterance && this.currentUtterance.onerror) {
							this.currentUtterance.onerror(e);
						}
					});
				}
				this.googlePaused = false;
				if (this.currentUtterance.onresume) {
					this.currentUtterance.onresume(new Event('resume'));
				}
			} else if (this.googlePaused && this.googleQueue.length > 0) {
				this.googlePaused = false;
				this._processGoogleQueue();
			}
		}

		async _processGoogleQueue() {
			if (this.currentUtterance || this.isDetectingLang) return; 

			if (this.googleQueue.length === 0) {
				this.googleSpeaking = false;
				this.googlePaused = false;
				return;
			}
			
			const utterance = this.googleQueue.shift();
			this.currentUtterance = utterance;

			let gap = Infinity;
			if (this.lastSequenceEndTime > 0) {
				const queuedGap = utterance._queuedAt - this.lastSequenceEndTime;
				gap = queuedGap < 0 ? 0 : queuedGap; 
			}

			if (gap > 500) {
				this.sequenceDominantLang = null;
				this.sequenceDominantProb = 0;
			}

			this.googleSpeaking = true;
			this.googlePaused = false;

			let lang = "auto";
			if (utterance.voice && utterance.voice._isGoogleTTS) {
				lang = utterance.voice._lang;
			} else if (utterance.lang) {
				lang = utterance.lang;
			}
			
			if (lang === "auto") {
				if (this.sequenceDominantLang !== null && this.sequenceDominantProb === 1) {
					lang = this.sequenceDominantLang;
				} else {
					this.isDetectingLang = true;
					try {
						const detected = await detectLanguage(utterance.text);
						const detectedLang = detected.language || "en";
						const detectedProb = detected.probability;

						if (this.sequenceDominantLang === null) {
							lang = detectedLang;
							this.sequenceDominantLang = detectedLang;
							this.sequenceDominantProb = detectedProb;
						} else {
							if (detectedLang === this.sequenceDominantLang) {
								this.sequenceDominantProb = Math.max(this.sequenceDominantProb, detectedProb);
								lang = this.sequenceDominantLang;
							} else if (detectedProb > this.sequenceDominantProb) {
								lang = detectedLang;
								this.sequenceDominantLang = detectedLang;
								this.sequenceDominantProb = detectedProb;
							} else {
								lang = this.sequenceDominantLang;
							}
						}
					} catch (e) {
						console.warn("Language detection failed, falling back to 'en'", e);
						lang = "en";
					}
					this.isDetectingLang = false;
					
					if (this.currentUtterance !== utterance) return;
				}
			}
			
			const encodedText = encodeURIComponent(utterance.text);
			const baseUrl = `https://translate.google.com/translate_tts?client=tw-ob&tl=${lang}&q=${encodedText}`;

			const finalUrl = this.proxyFn ? this.proxyFn(baseUrl) : baseUrl;

			this.audioElement.src = finalUrl;
			this.audioElement.playbackRate = Math.max(0.5, Math.min(utterance.rate * 1.2, 4.0));
			this.audioElement.preservesPitch = true; 

			const playPromise = this.audioElement.play();
			
			if (playPromise !== undefined) {
				playPromise.catch(e => {
					if (e.name === 'AbortError') {
						return; 
					}
					
					const currUtt = this.currentUtterance;
					this.currentUtterance = null;
					
					this.lastSequenceEndTime = Date.now();
					setTimeout(() => this._processGoogleQueue(), 0);
					
					if (currUtt && currUtt.onerror) {
						currUtt.onerror(e);
					}
				});
			}
		}
	}

	const customSynth = new HybridSpeechSynthesis();
	
	try {
		delete window.speechSynthesis;
		Object.defineProperty(window, 'speechSynthesis', {
			value: customSynth,
			configurable: true,
			enumerable: true,
			writable: true
		});
	} catch (e) {
		window.speechSynthesis = customSynth;
	}
})();
