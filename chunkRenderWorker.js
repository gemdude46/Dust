'use strict';

var BLOCKSIZE;

var blocks, lighting, heights;

var buffer, bufferview;

var day;

var seed;

var cpos;

self.onmessage = function(msg) {
	blocks = msg.data.blocks;
	lighting = msg.data.lighting;
	buffer = msg.data.buffer;
	bufferview = new Uint8Array(buffer);
	day = msg.data.day;
	BLOCKSIZE = msg.data.bs;
	
	seed = JSON.stringify(cpos = msg.data.i);

	render();

	self.postMessage(msg.data.i);
};

function spixcol(x, y, clr) {
	const pixs = 4*(x + y * 128 * BLOCKSIZE);
	bufferview[pixs]   = clr[0];
	bufferview[pixs+1] = clr[1];
	bufferview[pixs+2] = clr[2];
	bufferview[pixs+3] = 255;
};

function sblkcol(x, y, clr) {
	for (let i = 0; i < BLOCKSIZE; i++)
		for (let j = 0; j < BLOCKSIZE; j++)
			spixcol(x * BLOCKSIZE + i, y * BLOCKSIZE + j, clr);
}

function render() {
	const rng = new alea(seed);
	for (let i = 0; i < 128; i++) {
		for (let j = 0; j < 128; j++) {
			const rn = rng.int32();
			const block = self.DustDataBlocks[blocks[j+i*128]];
			const depth = j + cpos.y * 128;
			const light = lighting[j+i*128] + (day ? Math.max(Math.min(1 - depth/256, 1), 0) : 0);

			if (block.render === 'none') {
				sblkcol(i, j, [0,255,255]);
			} else if (block.render === 'normal' || block.render === 'fluid') {
				let clr = block.color.slice();
				if (block.variation) {
					clr[0] += rn % block.variation;
					clr[1] += rn % block.variation;
					clr[2] += rn % block.variation;
				}
				clr[0] *= light;
				clr[1] *= light;
				clr[2] *= light;
				sblkcol(i, j, clr.map(x => 0 | (x < 0 ? 0 : x > 255 ? 255 : x)));
			} else {
				throw new TypeError(block.render);
			}
		}
	}
}

function lm(mod) {
	const constxhr = new XMLHttpRequest();
	constxhr.open('GET', mod, false);
	constxhr.send(null);

	if (constxhr.status === 200) {
		eval(constxhr.responseText);
	} else {
		throw new Error('GET ' + mod + ' returned status ' + constxhr.status);
	}
}

lm('lib/alea.js');
lm('constants.js');
