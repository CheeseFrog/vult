/**
 * Attaches horizontal swipe and trackpad gestures to a specific DOM element.
 * The element will physically translate along the X-axis during the gesture.
 */

function setupFrameGestures(frame, onSwipeLeft, onSwipeRight, animTargetID = frame.id) {
	const activationThreshold = 120; // Pixels required to trigger the final action
	let currentTranslateX = 0;
	let isInteracting = false;
	let wheelResetTimeout = null;


	// --- VISUAL FEEDBACK ---
	// Handles the "0.5 state" equivalent by physically moving the frame
	function updateTransform(x, animate = false) {
		let animTarget = document.getElementById(animTargetID);
		// Use a smooth transition only when snapping back, otherwise track 1-to-1
		animTarget.style.transition = animate ? "transform 0.3s ease-out, opacity 0.3s ease-out" : "none";
		animTarget.style.transform = `translateX(${x/6}px)`;
		animTarget.style.opacity = `${(activationThreshold-Math.abs(x))/activationThreshold}`
	}

	// Evaluates the gesture distance when the user lets go
	function finalizeGesture() {
		isInteracting = false;
		let snapBack = true;
		
		// Check if threshold was met
		if (currentTranslateX > activationThreshold) {
			if (onSwipeRight) onSwipeRight();
			snapBack = 0;
		} else if (currentTranslateX < -activationThreshold) {
			if (onSwipeLeft) onSwipeLeft();
			snapBack = 0;
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
		
		// Cancel any ongoing snap-back animations to immediately follow the finger
		frame.style.transition = "none";
	}, { passive: true });

	frame.addEventListener("touchmove", (e) => {
		if (isMultiTouch || !isInteracting) return;
		
		const touch = e.changedTouches[0];
		const deltaX = touch.pageX - touchStartX;
		const deltaY = touch.pageY - touchStartY;

		// Only track if the movement is predominantly horizontal
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			// Prevent native browser back/forward swiping if the event is cancelable
			if (e.cancelable) e.preventDefault();
			
			// Dampen the movement slightly (0.6 multiplier) for a heavier, premium feel
			currentTranslateX = deltaX * 0.6; 
			updateTransform(currentTranslateX, false);
		}
	}, { passive: false }); // passive: false required to allow e.preventDefault()

	frame.addEventListener("touchend", () => {
		if (isMultiTouch) return;
		finalizeGesture();
	});

	// --- TRACKPAD / WHEEL GESTURES ---
	frame.addEventListener("wheel", (e) => {
		// Ignore vertical scrolling, only track horizontal trackpad swipes
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return;
		
		isInteracting = true;
		clearTimeout(wheelResetTimeout);

		// Accumulate horizontal scroll delta (subtracting moves it intuitively with the swipe)
		currentTranslateX -= e.deltaX;
		
		// Cap the maximum visual translation so it doesn't fly entirely off-screen
		const maxPan = activationThreshold + 50;
		currentTranslateX = Math.max(-maxPan, Math.min(maxPan, currentTranslateX));

		updateTransform(currentTranslateX, false);

		// Trackpads don't have a reliable 'touchend' equivalent. 
		// A pause in wheel events indicates the gesture is finished.
		wheelResetTimeout = setTimeout(finalizeGesture, 150);
	}, { passive: true });
}


function loadFabigation() {
	const myFrame = document.getElementById('view-reader');
	setupFrameGestures(myFrame, ()=>{nextChapter()}, ()=>{prevChapter()}, 'versesContainer');
}

if (document.readyState !== "loading") {
	loadFabigation()
} else {
	window.addEventListener("DOMContentLoaded", loadFabigation);
}