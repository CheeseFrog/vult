/**
 * Attaches horizontal swipe and trackpad gestures to a specific DOM element.
 * The element will physically translate along the X-axis during the gesture.
 */

function setupFrameGestures(frame, onSwipeLeft, onSwipeRight, animTargetID = frame.id) {
	const activationThreshold = 100; // Pixels required to trigger the final action
	const gestureSlop = 8; // Pixels moved before locking the gesture axis
	let currentTranslateX = 0;
	let isInteracting = false;
	let gestureAxis = null; // 'horizontal' | 'vertical' | null

	// --- VISUAL FEEDBACK ---
	function updateTransform(x, animate = false) {
		const animTarget = document.getElementById(animTargetID);
		if (!animTarget) return;

		// Use a smooth transition only when snapping back, otherwise track 1-to-1
		animTarget.style.transition = animate ? "transform 0.35s ease-out, opacity 0.35s ease-out" : "none";
		animTarget.style.transition = animate ? "transform var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out)" : "none";
		animTarget.style.transform = `translateX(${x / 5}px)`;
		animTarget.style.opacity = `${1.5 * (activationThreshold - Math.abs(x)) / activationThreshold}`;
	}

	// Evaluates the gesture distance when the user lets go
	function finalizeGesture() {
		isInteracting = false;
		let snapBack = true;

		// Check if threshold was met
		if (currentTranslateX > activationThreshold) {
			if (onSwipeRight) onSwipeRight();
			snapBack = false;
		} else if (currentTranslateX < -activationThreshold) {
			if (onSwipeLeft) onSwipeLeft();
			snapBack = false;
		}

		// Reset variables and animate frame back to origin
		currentTranslateX = 0;
		updateTransform(0, snapBack);
	}

	// --- TOUCH GESTURES ---
	let touchStartX = 0;
	let touchStartY = 0;
	let isMultiTouch = false;

	frame.addEventListener("touchstart", (e) => {
		const touch = e.changedTouches[0];
		touchStartX = touch.pageX;
		touchStartY = touch.pageY;
		isMultiTouch = e.touches.length > 1;
		isInteracting = true;
		gestureAxis = null; // Reset axis lock on new touch

		const animTarget = document.getElementById(animTargetID);
		if (animTarget) {
			animTarget.style.transition = "none";
		}
	}, { passive: true });

	frame.addEventListener("touchmove", (e) => {
		if (isMultiTouch || !isInteracting) return;

		const touch = e.changedTouches[0];
		const deltaX = touch.pageX - touchStartX;
		const deltaY = touch.pageY - touchStartY;
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		// Lock axis direction once movement exceeds initial slop threshold
		if (gestureAxis === null) {
			if (absX < gestureSlop && absY < gestureSlop) return;
			gestureAxis = absX > absY ? "horizontal" : "vertical";
		}

		// YIELD TO NATIVE SCROLL: Ignore horizontal calculations entirely if user is scrolling vertically
		if (gestureAxis === "vertical") return;

		// Lock horizontal swipe and prevent page scroll
		if (e.cancelable) e.preventDefault();

		currentTranslateX = deltaX * 0.8;
		updateTransform(currentTranslateX, false);
	}, { passive: false });

	frame.addEventListener("touchend", () => {
		if (isMultiTouch) return;
		if (gestureAxis === "horizontal") {
			finalizeGesture();
		} else {
			isInteracting = false;
		}
		gestureAxis = null;
	});
}

function loadFabigation() {
	const myFrame = document.getElementById('view-reader');
	setupFrameGestures(myFrame, () => { nextChapter(); }, () => { prevChapter(); }, 'versesContainer');
}

if (document.readyState !== "loading") {
	loadFabigation();
} else {
	window.addEventListener("DOMContentLoaded", loadFabigation);
}
