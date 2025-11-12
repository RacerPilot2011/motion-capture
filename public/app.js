import { Pose } from 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
import { Hands } from 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import { FaceMesh } from 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';

const video = document.getElementById('video');
let frames = [];
const FRAME_RATE = 30;

const JOINTS = ["Hips","Spine","Chest","Neck","Head","LeftShoulder","LeftElbow","LeftWrist","RightShoulder","RightElbow","RightWrist"];

// MediaPipe setup
const pose = new Pose({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
pose.setOptions({modelComplexity:1,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
pose.onResults(onResults);

const hands = new Hands({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({maxNumHands:2,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
hands.onResults(onResults);

const faceMesh = new FaceMesh({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js`});
faceMesh.setOptions({maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5});
faceMesh.onResults(onResults);

// Callback to save frame
function onResults(results){
    const frame = {};
    if(results.poseLandmarks){
        frame.Hips = results.poseLandmarks[0] || {x:0.5,y:0.5,z:0};
        frame.Spine = results.poseLandmarks[11] || {x:0.5,y:0.5,z:0};
        frame.Chest = results.poseLandmarks[12] || {x:0.5,y:0.5,z:0};
        frame.Neck = results.poseLandmarks[0] || {x:0.5,y:0.5,z:0};
        frame.Head = results.poseLandmarks[0] || {x:0.5,y:0.5,z:0};
        frame.LeftShoulder = results.poseLandmarks[11] || {x:0.5,y:0.5,z:0};
        frame.RightShoulder = results.poseLandmarks[12] || {x:0.5,y:0.5,z:0};
        frame.LeftElbow = results.poseLandmarks[13] || {x:0.5,y:0.5,z:0};
        frame.LeftWrist = results.poseLandmarks[15] || {x:0.5,y:0.5,z:0};
        frame.RightElbow = results.poseLandmarks[14] || {x:0.5,y:0.5,z:0};
        frame.RightWrist = results.poseLandmarks[16] || {x:0.5,y:0.5,z:0};
    }
    frames.push(frame);
}

// Start webcam capture
document.getElementById('startWebcam').onclick = async ()=>{
    const stream = await navigator.mediaDevices.getUserMedia({video:true});
    video.srcObject = stream;
    video.play();

    const processFrame = async ()=>{
        await pose.send({image: video});
        await hands.send({image: video});
        await faceMesh.send({image: video});
        if(!video.paused && !video.ended){
            requestAnimationFrame(processFrame);
        }
    };
    requestAnimationFrame(processFrame);
};

// Stop webcam and export BVH
document.getElementById('stopWebcam').onclick = async ()=>{
    video.pause();
    if(video.srcObject){
        video.srcObject.getTracks().forEach(t=>t.stop());
    }

    const res = await fetch('/saveBVH',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({frames})
    });
    const data = await res.json();
    alert(`BVH saved to ${data.file}`);
    frames = [];
};
