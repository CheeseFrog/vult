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
		// Usually the detected source language is in data[2].
		return {
			language: data[2] || null,
			raw: data
		};
	}
	
	const customLocales = ['en', 'en-US', 'en-GB', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'pt','ru', 'zh'];
	const Languages = ['English', 'English', 'English', 'Arabic', 'German', 'Spanish', 'French', 'Hindi', 'Japanese', 'Portuguese', 'Russian', 'Chinese'];
	const googleVoices = customLocales.map(lang => ({
		default: lang === 'en',
		lang: "[web]",
		localService: false,
		name: `Google TTS - ${Languages[customLocales.indexOf(lang)]} (${lang})`,
		voiceURI: `Google Translate TTS (${lang})`,
		_lang: lang,
		_isGoogleTTS: true
	}));
	
	// Add the auto-detect option to the voices array
	googleVoices.unshift({
		default: false,
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
				this.lang = "en";
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
			this.currentAudio = null;
			this.currentUtterance = null;
			this.activeAudios = new Set();
			
			this.proxyFn = null;
			
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
				return [...nativeVoices, ...googleVoices];
			}
			return nativeVoices;
		}

		speak(utterance) {
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

			this.activeAudios.forEach(audio => {
				audio.onplay = null;
				audio.onended = null;
				audio.onerror = null;
				audio.pause();
				audio.removeAttribute('src');
				audio.load();
			});
			this.activeAudios.clear();
			
			this.googleQueue = [];
			this.googleSpeaking = false;
			this.googlePaused = false;
			this.isDetectingLang = false;
			this.currentAudio = null;
			this.currentUtterance = null;
		}

		pause() {
			if (nativeSynth) {
				nativeSynth.pause();
			}

			if (this.currentAudio && !this.googlePaused) {
				this.currentAudio.pause();
				this.googlePaused = true;
				if (this.currentUtterance && this.currentUtterance.onpause) {
					this.currentUtterance.onpause(new Event('pause'));
				}
			}
		}

		resume() {
			if (nativeSynth) {
				nativeSynth.resume();
			}

			if (this.currentAudio && this.googlePaused) {
				const audio = this.currentAudio;
				const playPromise = audio.play();
				
				if (playPromise !== undefined) {
					playPromise.catch(e => {
						if (this.currentAudio !== audio) return;
						if (e.name !== 'AbortError' && this.currentUtterance && this.currentUtterance.onerror) {
							this.currentUtterance.onerror(e);
						}
					});
				}
				this.googlePaused = false;
				if (this.currentUtterance && this.currentUtterance.onresume) {
					this.currentUtterance.onresume(new Event('resume'));
				}
			} else if (this.googlePaused && this.googleQueue.length > 0) {
				this.googlePaused = false;
				this._processGoogleQueue();
			}
		}

		async _processGoogleQueue() {
			if (this.currentAudio || this.isDetectingLang) return; 

			if (this.googleQueue.length === 0) {
				this.googleSpeaking = false;
				this.googlePaused = false;
				return;
			}

			this.googleSpeaking = true;
			this.googlePaused = false;
			
			const utterance = this.googleQueue.shift();
			this.currentUtterance = utterance;

			let lang = "en";
			if (utterance.voice && utterance.voice._isGoogleTTS) {
				lang = utterance.voice._lang;
			} else if (utterance.lang) {
				lang = utterance.lang;
			}
			
			if (lang === "auto") {
				this.isDetectingLang = true;
				try {
					const detected = await detectLanguage(utterance.text);
					lang = detected.language || "en";
				} catch (e) {
					console.warn("Language detection failed, falling back to 'en'", e);
					lang = "en";
				}
				this.isDetectingLang = false;
				
				// Critical check: abort if engine was cancelled while waiting for language detection
				if (this.currentUtterance !== utterance) return;
			}
			
			const encodedText = encodeURIComponent(utterance.text);
			const baseUrl = `https://translate.google.com/translate_tts?client=tw-ob&tl=${lang}&q=${encodedText}`;

			const finalUrl = this.proxyFn ? this.proxyFn(baseUrl) : baseUrl;

			const audio = new Audio(finalUrl);
			this.activeAudios.add(audio);
			this.currentAudio = audio;
			
			audio.playbackRate = Math.max(0.5, Math.min(utterance.rate*1.2, 4.0));
			audio.preservesPitch = true; 

			const cleanup = () => {
				audio.onplay = null;
				audio.onended = null;
				audio.onerror = null;
				this.activeAudios.delete(audio);
			};

			audio.onplay = () => {
				if (this.currentAudio !== audio) return;
				if (this.currentUtterance && this.currentUtterance.onstart) {
					this.currentUtterance.onstart(new Event('start'));
				}
			};

			audio.onended = () => {
				if (this.currentAudio !== audio) return;
				cleanup();
				
				const currUtt = this.currentUtterance;
				this.currentAudio = null;
				this.currentUtterance = null;
				
				if (currUtt && currUtt.onend) {
					currUtt.onend(new Event('end'));
				}
				
				this._processGoogleQueue();
			};

			audio.onerror = (e) => {
				if (this.currentAudio !== audio) return;
				cleanup();
				
				const currUtt = this.currentUtterance;
				this.currentAudio = null;
				this.currentUtterance = null;
				
				if (currUtt && currUtt.onerror) {
					currUtt.onerror(e);
				}
				
				this._processGoogleQueue();
			};

			const playPromise = audio.play();
			
			if (playPromise !== undefined) {
				playPromise.catch(e => {
					if (this.currentAudio !== audio) return;
					
					if (e.name === 'AbortError') {
						return; 
					}
					
					cleanup();
					
					const currUtt = this.currentUtterance;
					this.currentAudio = null;
					this.currentUtterance = null;
					
					if (currUtt && currUtt.onerror) {
						currUtt.onerror(e);
					}
					
					this._processGoogleQueue();
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