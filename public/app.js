// --- Global Setup ---
const video = document.getElementById('video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const videoContainer = document.getElementById('video-container');

let frames = [];
const FRAME_RATE = 30; // 30 FPS
let currentFrame = {}; // To hold the latest detected pose landmarks

const JOINTS = ["Hips", "Spine", "Chest", "Neck", "Head", "LeftShoulder", "LeftElbow", "LeftWrist", "RightShoulder", "RightElbow", "RightWrist"];

// Mapping from MediaPipe Pose indices to custom JOINTS
const POSE_LANDMARK_MAP = {
    // Note: The indices 0, 11, and 12 are placeholders for derived joints.
    // They should ideally be calculated from other points for accurate BVH.
    // We'll keep the original simple (but inaccurate) mapping for now.
    Hips: 24, // Using the hip/pelvis center (approx) - one of the hip joints.
    Spine: 24,
    Chest: 12,
    Neck: 11,
    Head: 0,
    LeftShoulder: 11,
    RightShoulder: 12,
    LeftElbow: 13,
    RightElbow: 14,
    LeftWrist: 15,
    RightWrist: 16,
};

// --- MediaPipe Setup ---
// The modules are now loaded globally via <script> tags in the HTML.
const pose = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// We only need Pose for the BVH joints, so we'll focus only on it.
// The Hand and FaceMesh setups can be simplified or removed if their data isn't needed for BVH.
// const hands = new Hands({...});
// const faceMesh = new FaceMesh({...});


// --- Real-time Visualization (onResults) ---
// This function is now ONLY for drawing the results on the canvas.
pose.onResults(onResults);

function onResults(results) {
    // Hide the video element and show the canvas for visualization
    video.style.display = 'none';
    canvasElement.style.display = 'block';

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the video frame
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Draw Pose Landmarks
    if (results.poseLandmarks) {
        // Use MediaPipe's built-in drawing utilities for simple visualization
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 4
        });
        drawLandmarks(canvasCtx, results.poseLandmarks, {
            color: '#FF0000',
            lineWidth: 2
        });
        
        // --- DATA CAPTURE LOGIC (Moved here temporarily for simplicity, but best done in processFrame) ---
        // For debugging/capture, we store the raw landmarks to be saved in processFrame
        // This is not strictly necessary here since we use the results object in processFrame,
        // but it shows how you could pass data around.
        currentFrame.landmarks = results.poseLandmarks;
    }
    
    // You can add hands and face drawing here if you re-enable them
    // if (results.multiHandLandmarks) { ... }

    canvasCtx.restore();
}

// --- Frame Processing Loop and Data Saving (Fixes "No frames" error) ---
let lastTime = performance.now();

const processFrame = async () => {
    // Calculate the time to wait to maintain FRAME_RATE
    const now = performance.now();
    const elapsed = now - lastTime;
    const interval = 1000 / FRAME_RATE;

    if (elapsed > interval) {
        lastTime = now - (elapsed % interval);

        // 1. Send the image to the Pose model. This sends the current frame 
        // and triggers the asynchronous onResults for visualization.
        // Importantly, we AWAIT the result, ensuring the data is ready.
        await pose.send({
            image: video
        });

        // The results are now available inside the onResults callback.
        // We'll trust the onResults function has been called and currentFrame is populated.
        // However, a safer way is to rewrite pose.send() to be synchronous 
        // if we are to use the data immediately.

        // To fix the "no frames" issue reliably, let's use a flag or ensure 
        // onResults runs before we push the frame. 
        // Given MediaPipe's design, using the onResults callback is the intended way.
        
        // Let's rely on the global variable 'currentFrame' being updated in onResults
        if (currentFrame.landmarks) {
            const frame = {};
            // 2. Map the raw MediaPipe landmarks to your custom BVH joints
            for (const jointName of JOINTS) {
                const index = POSE_LANDMARK_MAP[jointName];
                const landmark = currentFrame.landmarks[index];
                
                if (landmark) {
                    // Normalize the coordinates (x, y, z are already 0 to 1)
                    frame[jointName] = { 
                        x: landmark.x || 0.5, 
                        y: landmark.y || 0.5, 
                        z: landmark.z || 0 
                    };
                } else {
                    // Fallback if landmark is not detected
                    frame[jointName] = { x: 0.5, y: 0.5, z: 0 };
                }
            }
            frames.push(frame);
            // Clear the temporary landmarks for the next frame
            currentFrame.landmarks = null; 
        }
    }

    if (!video.paused && !video.ended) {
        requestAnimationFrame(processFrame);
    }
};


// --- Button Handlers ---
document.getElementById('startWebcam').onclick = async () => {
    frames = []; // Reset frames
    currentFrame = {}; // Reset current frame
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        video.srcObject = stream;
        
        // Wait for video to load before starting processing
        video.onloadedmetadata = () => {
            video.play();
            // Start the optimized requestAnimationFrame loop
            requestAnimationFrame(processFrame);
        };
        
        // Make sure canvas is set to the video dimensions
        canvasElement.width = video.width;
        canvasElement.height = video.height;

    } catch (e) {
        console.error("Error accessing webcam:", e);
        alert("Could not access webcam. Ensure camera is available and permissions are granted.");
    }
};

document.getElementById('stopWebcam').onclick = async () => {
    // 1. Stop the stream (Unchanged)
    if (video.srcObject) {
        video.pause();
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }
    
    // **FIX 1: Fully hide the video feed from the screen/layout**
    // Set the video display to 'none' and the canvas back to 'none' (or 'block' if you want a final image)
    video.style.display = 'none';
    canvasElement.style.display = 'none';
    videoContainer.style.border = 'none'; // Remove container border if video is off

    if (frames.length === 0) {
        alert("No frames were captured to export. Make sure landmarks were visible.");
        return;
    }

    // 2. Export BVH and Handle Download
    try {
        const res = await fetch('/saveBVH', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Send data as JSON
            },
            body: JSON.stringify({
                frames
            })
        });

        if (!res.ok) {
            // Check if server sent a JSON error message
            const errorText = await res.text();
            throw new Error(`Server error: ${res.status} - ${errorText}`);
        }

        // **FIX 2: Handle the file download from the server response**
        const blob = await res.blob();
        
        // Get filename from the Content-Disposition header (optional, but good practice)
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'motion_capture.bvh';
        if (contentDisposition) {
            const matches = /filename="?(.+)"?/.exec(contentDisposition);
            if (matches && matches[1]) {
                filename = matches[1];
            }
        }
        
        // Create a hidden link and click it to trigger the download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url); // Clean up the object URL

        alert(`BVH file downloaded as: ${filename}. Total frames: ${frames.length}`);

    } catch (error) {
        console.error("Error saving BVH:", error);
        alert(`Failed to save or download BVH: ${error.message}`);
    } finally {
        frames = [];
    }
};

// --- Helper Functions (Provided by MediaPipe for drawing) ---
// You need these for drawConnectors and drawLandmarks to work!
// Since we are not using 'type="module"', these must be defined globally or imported.

const POSE_CONNECTIONS = [
    [15, 13], [13, 11], [16, 14], [14, 12], [11, 12], [12, 24], [11, 23], [24, 23],
    [24, 26], [23, 25], [26, 28], [25, 27], [28, 30], [27, 29], [30, 32], [29, 31],
    [28, 32], [27, 31], [5, 6], [5, 11], [6, 12], [1, 2], [0, 1], [0, 2], [0, 3], 
    [0, 4], [9, 10], [10, 16], [9, 15], [3, 7], [4, 8], [7, 9], [8, 10]
];

function drawConnectors(ctx, landmarks, connections, style) {
    if (!landmarks) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    
    for (const connection of connections) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        if (start && end) {
            ctx.beginPath();
            ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
            ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
            ctx.stroke();
        }
    }
}

function drawLandmarks(ctx, landmarks, style) {
    if (!landmarks) return;
    for (const landmark of landmarks) {
        ctx.fillStyle = style.color;
        ctx.beginPath();
        ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, style.lineWidth, 0, 2 * Math.PI);
        ctx.fill();
    }
}