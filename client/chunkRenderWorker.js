'use strict';

m_supplies('client/chunkRenderWorker.js');
m_require('lib/alea.js');
m_require('common/constants.js');

var BLOCKSIZE;

var blocks, bgs, lighting, heights;

var buffer, bufferview;

var day;

var seed;

var cpos;

self.onmessage = function(msg) {
	blocks = msg.data.blocks;
	bgs = msg.data.bgs;
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
			const bg = self.DustDataBgs[bgs[j+i*128]];
			const depth = j + cpos.y * 128;

			if (block.render === 'none') {
				if (bg.render === 'none') {
					sblkcol(i, j, [0,255,255]);
				} else if (bg.render === 'normal') {
					const light = lighting[j+i*128] + (day ? Math.max(Math.min(1 - depth/256, 1), 0) : 0);
					let clr = bg.color.slice();
					if (bg.variation) {
						clr[0] += rn % bg.variation;
						clr[1] += rn % bg.variation;
						clr[2] += rn % bg.variation;
					}
					clr[0] *= light;
					clr[1] *= light;
					clr[2] *= light;
					sblkcol(i, j, clr.map(x => 0 | (x < 0 ? 0 : x > 255 ? 255 : x)));
				}
			} else if (block.render === 'normal' || block.render === 'fluid') {
				const light = lighting[j+i*128] + (day ? Math.max(Math.min(1 - depth/256, 1), 0) : 0);
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

