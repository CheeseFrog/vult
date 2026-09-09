(function (window, document) {
	"use strict";

	const STYLE_ID = "ios-select-dialog-styles";

	const CSS = `
		/*.ios-select-dialog {
			--bg-color: #f2f2f7;
			--surface-color: #ffffff;
			--surface-color-active: #e5e5ea;
			--text-color: #000000;
			--text-muted: #8e8e93;
			--primary-color: #007aff;
			--border-color: #94949880;
			--highlight: color-mix(in srgb, var(--primary-color) 30%, transparent);
			--shadow: 0 4px 12px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,.22), 0 0 0 1px hsla(0,0%,100%,0.08) inset;
			--base-sans-serif: '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', Arial, sans-serif;
			--radius-sm: 8px;
			--radius-md: 12px;
			--radius-lg: 28px;
			--radius-full: 50%;
		}*/

		.ios-select-dialog {
			width: calc(100% - 24px);
			max-width: 420px;
			max-height: 80vh;
			padding: 0;
			border: 0;
			border-radius: var(--radius-md);
			background: var(--surface-color);
			color: var(--text-color);
			box-shadow: var(--shadow);
			font-family: var(--base-sans-serif);
			animation: ios-dialog-in 180ms ease-out;
		}

		.ios-select-dialog::backdrop {
			background: rgba(0, 0, 0, 0.35);
			animation: ios-backdrop-in 160ms ease-out;
		}

		.ios-select-dialog__header {
			position: relative;
			display: flex;
			align-items: center;
			justify-content: space-between;
			min-height: 54px;
			padding: 8px 16px;
			border-bottom: 1px solid var(--border-color);
		}

		.ios-select-dialog__header-default {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			gap: 8px;
		}

		.ios-select-dialog__header-search {
			display: none;
			align-items: center;
			width: 100%;
			gap: 8px;
		}

		.ios-select-dialog[data-searching="true"] .ios-select-dialog__header-default {
			display: none;
		}

		.ios-select-dialog[data-searching="true"] .ios-select-dialog__header-search {
			display: flex;
		}

		.ios-select-dialog__title {
			margin: 0;
			font-size: 17px;
			font-weight: 600;
			flex-grow: 1;
			text-align: center;
			color: var(--text-color);
		}

		.ios-select-dialog__icon-btn {
			width: 36px;
			height: 36px;
			padding: 0;
			border: 0;
			border-radius: var(--radius-full);
			background: var(--surface-color-active);
			color: var(--text-muted);
			font: inherit;
			line-height: 36px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}

		.ios-select-dialog__close {
			font-size: 22px;
		}

		.ios-select-dialog__search-input {
			flex-grow: 1;
			height: 36px;
			padding: 0 12px;
			border: 0;
			border-radius: var(--radius-lg);
			background: var(--surface-color-active);
			color: var(--text-color);
			font: inherit;
			font-size: 16px;
			outline: none;
		}

		.ios-select-dialog__search-input::placeholder {
			color: var(--text-muted);
		}

		.ios-select-dialog__cancel-btn {
			border: 0;
			background: transparent;
			color: var(--primary-color);
			font: inherit;
			font-size: 16px;
			cursor: pointer;
			padding: 0 4px;
			flex-shrink: 0;
		}

		.ios-select-dialog__options {
			max-height: calc(80vh - 55px);
			overflow-y: auto;
			padding: 8px;
			-webkit-overflow-scrolling: touch;
		}

		.ios-select-dialog__group {
			margin: 8px 0;
		}

		.ios-select-dialog__group + .ios-select-dialog__group {
			margin-top: 12px;
		}

		.ios-select-dialog__group-label {
			padding: 6px 8px;
			color: var(--text-muted);
			font-size: 13px;
			font-weight: 600;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			border-bottom: 1px solid var(--border-color);
		}

		.ios-select-dialog__group[aria-disabled="true"]
			.ios-select-dialog__group-label {
			color: var(--text-muted);
			opacity: 0.6;
		}

		.ios-select-dialog__option {
			display: flex;
			align-items: center;
			width: 100%;
			min-height: 48px;
			padding: 6px 8px;
			margin: 6px 0;
			border: 0;
			border-radius: var(--radius-sm);
			background: transparent;
			color: var(--text-color);
			font: inherit;
			font-size: 17px;
			text-align: left;
			cursor: pointer;
			-webkit-tap-highlight-color: transparent;
		}

		.ios-select-dialog__option:hover,
		.ios-select-dialog__option:focus-visible {
			outline: none;
			background: var(--highlight);
		}

		.ios-select-dialog__option[aria-selected="true"] {
			color: var(--primary-color);
			font-weight: 600;
		}

		/* .ios-select-dialog__option[aria-selected="true"]::after {
			content: "✓";
			margin-left: auto;
		} */

		.ios-select-dialog__option:disabled {
			color: var(--text-muted);
			cursor: not-allowed;
		}

		.ios-select-dialog__separator {
			height: 1px;
			margin: 8px 12px;
			border: 0;
			background: var(--border-color);
		}

		.ios-select-dialog__group + .ios-select-dialog__separator {
			display: none;
		}

		.ios-select-dialog__option[hidden],
		.ios-select-dialog__group[hidden] {
			display: none !important;
		}

		@keyframes ios-dialog-in {
			from {
				opacity: 0;
				transform: translateY(16px) scale(0.98);
			}

			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}

		@keyframes ios-backdrop-in {
			from {
				opacity: 0;
			}

			to {
				opacity: 1;
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.ios-select-dialog,
			.ios-select-dialog::backdrop {
				animation: none;
			}
		}
	`;

	const IOSSelect = {
		dialog: null,
		activeSelect: null,

		init() {
			this.injectStyles();
			this.createDialog();

			// Event delegation supports selects added dynamically.
			document.addEventListener("click", (event) => {
				const select = event.target.closest("select");

				if (!select) return;

				event.preventDefault();
				this.open(select);
			});
			document.addEventListener("mousedown", (event) => {
				const select = event.target.closest("select");

				if (!select) return;

				event.preventDefault();
				this.open(select);
			});

			document.addEventListener("keydown", (event) => {
				const select = event.target.closest("select");

				if (!select) return;

				if (
					event.key === "Enter" ||
					event.key === " " ||
					event.key === "ArrowDown" ||
					event.key === "ArrowUp"
				) {
					event.preventDefault();
					this.open(select);
				}
			});
		},

		injectStyles() {
			if (document.getElementById(STYLE_ID)) return;

			const style = document.createElement("style");

			style.id = STYLE_ID;
			style.textContent = CSS;

			document.head.appendChild(style);
		},

		createDialog() {
			if (this.dialog) return;

			const dialog = document.createElement("dialog");

			dialog.className = "ios-select-dialog";

			dialog.innerHTML = `
				<div class="ios-select-dialog__header">
					<div class="ios-select-dialog__header-default">
						<button
							type="button"
							class="ios-select-dialog__icon-btn ios-select-dialog__search-btn"
							aria-label="Search options"
						>
							🔎︎
						</button>
						<h2 class="ios-select-dialog__title"></h2>
						<button
							type="button"
							class="ios-select-dialog__icon-btn ios-select-dialog__close"
							aria-label="Close"
						>
							×
						</button>
					</div>
					<div class="ios-select-dialog__header-search">
						<input
							type="text"
							class="ios-select-dialog__search-input"
							placeholder="Search"
							aria-label="Filter options"
						/>
						<button
							type="button"
							class="ios-select-dialog__cancel-btn"
						>
							Cancel
						</button>
					</div>
				</div>

				<div
					class="ios-select-dialog__options"
					role="listbox"
				></div>
			`;

			const searchBtn = dialog.querySelector(".ios-select-dialog__search-btn");
			const cancelBtn = dialog.querySelector(".ios-select-dialog__cancel-btn");
			const searchInput = dialog.querySelector(".ios-select-dialog__search-input");
			const closeButton = dialog.querySelector(".ios-select-dialog__close");

			searchBtn.addEventListener("click", () => {
				dialog.setAttribute("data-searching", "true");
				searchInput.focus();
			});

			const exitSearch = () => {
				dialog.removeAttribute("data-searching");
				searchInput.value = "";
				this.filterOptions("");
			};

			cancelBtn.addEventListener("click", exitSearch);

			searchInput.addEventListener("input", (e) => {
				this.filterOptions(e.target.value);
			});

			closeButton.addEventListener("click", () => {
				dialog.close();
			});

			dialog.addEventListener("cancel", (event) => {
				event.preventDefault();
				dialog.close();
			});

			dialog.addEventListener("close", () => {
				exitSearch();
				this.clearDialog();
				this.activeSelect = null;
			});

			document.body.appendChild(dialog);

			this.dialog = dialog;
		},

		filterOptions(query) {
			if (!this.dialog) return;

			const cleanQuery = query.trim().toLowerCase();
			const optionsContainer = this.dialog.querySelector(".ios-select-dialog__options");

			// Handle grouped options first
			const groups = optionsContainer.querySelectorAll(".ios-select-dialog__group");
			groups.forEach((group) => {
				const groupLabel = group.getAttribute("aria-label") || "";
				const groupLabelMatches = cleanQuery !== "" && groupLabel.toLowerCase().includes(cleanQuery);
				const groupOptions = group.querySelectorAll(".ios-select-dialog__option");
				let hasMatchingChild = false;

				groupOptions.forEach((option) => {
					const text = option.textContent.toLowerCase();
					const optionMatches = text.includes(cleanQuery);

					if (groupLabelMatches || optionMatches || !cleanQuery) {
						option.removeAttribute("hidden");
						hasMatchingChild = true;
					} else {
						option.setAttribute("hidden", "");
					}
				});

				if (groupLabelMatches || hasMatchingChild || !cleanQuery) {
					group.removeAttribute("hidden");
				} else {
					group.setAttribute("hidden", "");
				}
			});

			// Handle standalone options outside groups
			const standaloneOptions = optionsContainer.querySelectorAll(":scope > .ios-select-dialog__option");
			standaloneOptions.forEach((option) => {
				const text = option.textContent.toLowerCase();
				if (text.includes(cleanQuery) || !cleanQuery) {
					option.removeAttribute("hidden");
				} else {
					option.setAttribute("hidden", "");
				}
			});
		},

		clearDialog() {
			if (!this.dialog) return;

			this.dialog.querySelector(
				".ios-select-dialog__title"
			).textContent = "";

			this.dialog.querySelector(
				".ios-select-dialog__options"
			).replaceChildren();
		},

		open(select) {
			if (!this.dialog) {
				this.createDialog();
			}

			if (this.dialog.open) {
				this.dialog.close();
			}

			this.clearDialog();

			this.activeSelect = select;

			const title =
				select.getAttribute("aria-label") ||
				select.getAttribute("name") ||
				"Choose an option";

			const titleElement = this.dialog.querySelector(
				".ios-select-dialog__title"
			);

			const optionsContainer = this.dialog.querySelector(
				".ios-select-dialog__options"
			);

			const closeButton = this.dialog.querySelector(
				".ios-select-dialog__close"
			);

			titleElement.textContent = title;

			const selectedIndex = select.selectedIndex;
			let optionIndex = 0;

			const addSeparator = (container) => {
				const separator = document.createElement("hr");

				separator.className = "ios-select-dialog__separator";
				separator.setAttribute("role", "separator");

				container.appendChild(separator);
			};

			const addOption = (option, container, parentGroup = null) => {
				const optionButton = document.createElement("button");

				const currentIndex = optionIndex;

				const isDisabled =
					select.disabled ||
					option.disabled ||
					Boolean(parentGroup && parentGroup.disabled);

				optionButton.type = "button";
				optionButton.className = "ios-select-dialog__option";
				optionButton.textContent = option.textContent;
				optionButton.disabled = isDisabled;
				optionButton.setAttribute("role", "option");
				optionButton.setAttribute(
					"aria-selected",
					currentIndex === selectedIndex ? "true" : "false"
				);

				optionButton.addEventListener("click", () => {
					if (isDisabled) return;

					select.selectedIndex = currentIndex;

					select.dispatchEvent(
						new Event("change", {
							bubbles: true
						})
					);

					this.close();
					select.focus();
				});

				container.appendChild(optionButton);
				optionIndex += 1;
			};

			const addChild = (child, container, parentGroup = null) => {
				if (child.tagName === "OPTION") {
					addOption(child, container, parentGroup);
				} else if (child.tagName === "HR") {
					addSeparator(container);
				}
			};

			Array.from(select.children).forEach((child) => {
				if (child.tagName === "OPTGROUP") {
					const group = document.createElement("div");

					group.className = "ios-select-dialog__group";
					group.setAttribute("role", "group");

					if (child.label) {
						group.setAttribute("aria-label", child.label);
					}

					if (child.disabled) {
						group.setAttribute("aria-disabled", "true");
					}

					if (child.label) {
						const groupLabel = document.createElement("div");

						groupLabel.className = "ios-select-dialog__group-label";
						groupLabel.textContent = child.label;

						group.appendChild(groupLabel);
					}

					Array.from(child.children).forEach((groupChild) => {
						addChild(groupChild, group, child);
					});

					optionsContainer.appendChild(group);
				} else {
					addChild(child, optionsContainer);
				}
			});

			this.dialog.showModal();

			const selectedOption = optionsContainer.querySelector(
				'[aria-selected="true"]'
			);

			(selectedOption || closeButton).focus();
		},

		close() {
			if (!this.dialog || !this.dialog.open) return;

			this.dialog.close();
		}
	};

	window.IOSSelect = IOSSelect;

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			IOSSelect.init();
		});
	} else {
		IOSSelect.init();
	}
})(window, document);