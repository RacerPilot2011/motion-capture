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
    const SCALE = 200; // This scale factor is arbitrary; adjust based on desired size in 3D tool.

    // Helper function to build the BVH Header (You'll likely need to expand this for full human skeleton support)
    function buildBVHHeader(){
        // The current header is very simple and likely not valid for most BVH consumers. 
        // A proper BVH requires joint rotations and accurate hierarchy.
        let s = "HIERARCHY\nROOT Hips\n{\n\tOFFSET 0 0 0\n\tCHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation\n";
        s += "\tJOINT Spine\n\t{\n\t\tOFFSET 0 0.1 0\n\t\tCHANNELS 3 Zrotation Xrotation Yrotation\n";
        s += "\t\tJOINT Chest\n\t\t{\n\t\t\tOFFSET 0 0.1 0\n\t\t\tCHANNELS 3 Zrotation Xrotation Yrotation\n";
        
        // ... (This is where the rest of the joints would be defined in a full BVH file)
        
        s += "\t\t}\n\t}\n}\nMOTION\n";
        
        // **IMPORTANT:** Since your frame data only contains position (X, Y, Z), 
        // the header is simplified to match the input. The original header was:
        // let s = "HIERARCHY\nROOT Hips\n{\n\tOFFSET 0 0 0\n\tCHANNELS 3 Xposition Yposition Zposition\n";
        // s += "\tJOINT Spine{OFFSET 0 10 0 CHANNELS 3 Xposition Yposition Zposition}\n";
        // s += "\tJOINT Chest{OFFSET 0 10 0 CHANNELS 3 Xposition Yposition Zposition}\n";
        // s += "}\nMOTION\n";
        // I will use a simple, position-only header for consistency with the frontend data, 
        // but note that BVH is primarily for rotation data.
        
        let header = "HIERARCHY\nROOT Hips\n{\n\tOFFSET 0 0 0\n\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\tJOINT Spine\n\t{\n\t\tOFFSET 0 10 0\n\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\tJOINT Chest\n\t\t{\n\t\t\tOFFSET 0 10 0\n\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\tJOINT Neck\n\t\t\t{\n\t\t\t\tOFFSET 0 10 0\n\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\tJOINT Head\n\t\t\t\t{\n\t\t\t\t\tOFFSET 0 10 0\n\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\tJOINT LeftShoulder\n\t\t\t\t\t{\n\t\t\t\t\t\tOFFSET 10 0 0\n\t\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\t\tJOINT LeftElbow\n\t\t\t\t\t\t{\n\t\t\t\t\t\t\tOFFSET 10 0 0\n\t\t\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\t\t\tJOINT LeftWrist\n\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\tOFFSET 10 0 0\n\t\t\t\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\t\t\t\tEnd Site\n\t\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\t\tOFFSET 0 0 0\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n";
        header += "\t\t\t\t\tJOINT RightShoulder\n\t\t\t\t\t{\n\t\t\t\t\t\tOFFSET -10 0 0\n\t\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\t\tJOINT RightElbow\n\t\t\t\t\t\t{\n\t\t\t\t\t\t\tOFFSET -10 0 0\n\t\t\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\t\t\tJOINT RightWrist\n\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\tOFFSET -10 0 0\n\t\t\t\t\t\t\t\tCHANNELS 3 Xposition Yposition Zposition\n";
        header += "\t\t\t\t\t\t\t\tEnd Site\n\t\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\t\tOFFSET 0 0 0\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n";
        header += "\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}\nMOTION\n";

        return header;
    }

    // Function to handle coordinate scaling and conversion for BVH (assuming x, y, z were normalized [0, 1])
    function toBVHCoord(p){ return {x:(p.x-0.5)*SCALE, y:(0.5-p.y)*SCALE, z:-p.z*SCALE}; }

    // Function to format the motion data string
    function buildFramesText(frames){ 
        return frames.map(f=>JOINTS.map(j=>{ 
            const p=f[j]||{x:0.5,y:0.5,z:0}; 
            const bvhP = toBVHCoord(p); // Apply scaling and coordinate system conversion
            // Output is Xposition Yposition Zposition for each joint, concatenated
            return `${bvhP.x.toFixed(4)} ${bvhP.y.toFixed(4)} ${bvhP.z.toFixed(4)}`;
        }).join(' ')).join('\n'); 
    }

    const bvh = buildBVHHeader() + `Frames: ${frames.length}\nFrame Time: ${(1/FRAME_RATE).toFixed(8)}\n` + buildFramesText(frames);
    const fileName = `motion_capture_${Date.now()}.bvh`;
    const outPath = path.join(fileName);
    
    try {
        // 1. Write the file locally
        fs.writeFileSync(outPath, bvh);
        
        // 2. Send the file back for download and clean up
        res.download(outPath, fileName, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).send({ msg: 'Could not download the file.' });
            }
            // 3. Clean up the file after sending
            fs.unlink(outPath, (unlinkErr) => {
                if (unlinkErr) console.error('Failed to delete local file:', unlinkErr);
            });
        });

    } catch (e) {
        console.error("Error saving BVH:", e);
        res.status(500).send({ msg: 'Failed to write BVH file on server.' });
    }
});

app.listen(3000,()=>console.log('Server running on http://localhost:3000'));