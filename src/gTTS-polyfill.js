(function() {
	const nativeSynth = window.speechSynthesis;
	
	const customLocales = ['en', 'en-US', 'en-GB', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ru', 'zh'];
	const Languages = ['English', 'English', 'English', 'Arabic', 'German', 'Spanish', 'French', 'Hindi', 'Japanese', 'Russian', 'Chinese'];
	const googleVoices = customLocales.map(lang => ({
		default: false,
		lang: lang,
		localService: false,
		name: `Google - ${Languages[customLocales.indexOf(lang)]}`,
		voiceURI: `Google Translate TTS (${lang})`,
		_isGoogleTTS: true // Hidden flag for internal routing
	}));

	if (window.SpeechSynthesisUtterance) {
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
			this.currentAudio = null;
			this.currentUtterance = null;
			this.activeAudios = new Set();
			
			// Allow developers to inject a custom proxy routing function
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

		// New method to set a proxy callback
		setProxy(fn) {
			if (typeof fn === 'function') {
				this.proxyFn = fn;
			}
		}

		get speaking() {
			const nativeSpeaking = nativeSynth ? nativeSynth.speaking : false;
			return nativeSpeaking || this.googleSpeaking;
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
			if (utterance.voice && utterance.voice._isGoogleTTS) {
				this.googleQueue.push(utterance);
				if (!this.googleSpeaking && !this.googlePaused) {
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

		_processGoogleQueue() {
			if (this.currentAudio) return; 

			if (this.googleQueue.length === 0) {
				this.googleSpeaking = false;
				this.googlePaused = false;
				return;
			}

			this.googleSpeaking = true;
			this.googlePaused = false;
			this.currentUtterance = this.googleQueue.shift();

			let lang = "en";
			if (this.currentUtterance.voice && this.currentUtterance.voice._isGoogleTTS) {
				lang = this.currentUtterance.voice.lang;
			} else if (this.currentUtterance.lang) {
				lang = this.currentUtterance.lang;
			}
			
			const encodedText = encodeURIComponent(this.currentUtterance.text);
			const baseUrl = `https://translate.google.com/translate_tts?client=tw-ob&tl=${lang}&q=${encodedText}`;

			// Pass the URL through the proxy function if one is configured
			const finalUrl = this.proxyFn ? this.proxyFn(baseUrl) : baseUrl;

			const audio = new Audio(finalUrl);
			this.activeAudios.add(audio);
			this.currentAudio = audio;
			
			audio.playbackRate = Math.max(0.5, Math.min(this.currentUtterance.rate*1.2, 4.0));
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
				
				const utterance = this.currentUtterance;
				this.currentAudio = null;
				this.currentUtterance = null;
				
				if (utterance && utterance.onend) {
					utterance.onend(new Event('end'));
				}
				
				this._processGoogleQueue();
			};

			audio.onerror = (e) => {
				if (this.currentAudio !== audio) return;
				cleanup();
				
				const utterance = this.currentUtterance;
				this.currentAudio = null;
				this.currentUtterance = null;
				
				if (utterance && utterance.onerror) {
					utterance.onerror(e);
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
					
					const utterance = this.currentUtterance;
					this.currentAudio = null;
					this.currentUtterance = null;
					
					if (utterance && utterance.onerror) {
						utterance.onerror(e);
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

