import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json({limit:'500mb'})); // frames can be big

app.post('/saveBVH', (req, res) => {
  const frames = req.body.frames;
  if(!frames || !frames.length) return res.status(400).send('No frames');

  const JOINTS = ["Hips","Spine","Chest","Neck","Head","LeftShoulder","LeftElbow","LeftWrist","RightShoulder","RightElbow","RightWrist"];
  const FRAME_RATE = 30;
  const SCALE = 200;

  function buildBVHHeader(){
    let s = "HIERARCHY\nROOT Hips\n{\n\tOFFSET 0 0 0\n\tCHANNELS 3 Xposition Yposition Zposition\n";
    s += "\tJOINT Spine{OFFSET 0 10 0 CHANNELS 3 Xposition Yposition Zposition}\n";
    s += "\tJOINT Chest{OFFSET 0 10 0 CHANNELS 3 Xposition Yposition Zposition}\n";
    s += "}\nMOTION\n";
    return s;
  }

  function toBVHCoord(p){ return {x:(p.x-0.5)*SCALE, y:(0.5-p.y)*SCALE, z:-p.z*SCALE}; }
  function buildFramesText(frames){ 
    return frames.map(f=>JOINTS.map(j=>{ const p=f[j]||{x:0.5,y:0.5,z:0}; return `${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}`}).join(' ')).join('\n'); 
  }

  const bvh = buildBVHHeader() + `Frames: ${frames.length}\nFrame Time: ${(1/FRAME_RATE).toFixed(8)}\n` + buildFramesText(frames);
  const outPath = path.join('output.bvh');
  fs.writeFileSync(outPath,bvh);
  res.send({msg:'Saved BVH', file: outPath});
});

app.listen(3000,()=>console.log('Server running on http://localhost:3000'));
