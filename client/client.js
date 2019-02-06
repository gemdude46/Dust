'use strict';

var BLOCKSIZE = 4;

class DustClientChunk {

	constructor(x, y, blocks, bgs, client) {
		this.isChunkObject = true;
	
		this.client = client;
	
		this.x = x;
		this.y = y;
	
		this.sf = CreateSurface([128 * BLOCKSIZE, 128 * BLOCKSIZE]);
	
		this.idata = client.sf.ctx.createImageData(128 * BLOCKSIZE, 128 * BLOCKSIZE);

		this.blocks = blocks;
		this.bgs = bgs;
		this.lighting = Array(16384).fill(0.1);
	
		this.sfdirty = [0,0,128,128];
		
		for (let i = 0; i < 16384; i++) {
			this.addLighting(i);
		}
	}

	uds(data) {
		this.idata.data.set(new Uint8Array(data));
		this.sf.ctx.putImageData(this.idata, 0, 0);
	}
	
	dirtyBlock(x, y) {
		if (this.sfdirty) {
			if (x < this.sfdirty[0])	this.sfdirty[0] = x;
			if (y < this.sfdirty[1])	this.sfdirty[1] = y;
			if (x+2 > this.sfdirty[2])  this.sfdirty[2] = x+1;
			if (y+2 > this.sfdirty[3])  this.sfdirty[3] = y+1;
		} else this.sfdirty = [x, y, 1+x, 1+y];
	}
	
	setBlock(blk, pos) {
		const x = pos >> 7;
		const y = pos & 127;
		this.addLighting(pos, -1);
		this.blocks[pos] = blk;
		this.dirtyBlock(x, y);
		this.addLighting(pos);
	}
	
	addLighting(pos, mul) {
		const lum = DustDataBlocks[this.blocks[pos]].light;
		
		mul = mul || 1;
		
		if (lum) {
			const px = pos >> 7;
			const py = pos & 127;
			for (let x = px-50; x < px + 50; x++) {
				for (let y = py - 50; y < py + 50; y++) {
					const d = Math.sqrt((x - px)*(x - px) + (y - py)*(y - py));
					const al = Math.max(50/(d+(1/lum)) - 1, 0) * mul;
					if (al !== 0) {
						if (x < 0 || y < 0 || x > 127 || y > 127)
							this.client.addLighting(this.x * 128 + x, this.y * 128 + y, al);
						else {
							this.lighting[y+128*x] += al;
							this.dirtyBlock(x, y);
						}
					}
				}
			}
		}
	}


	render() {
		const buffer = new ArrayBuffer(this.idata.data.byteLength);
		this.client.getRenderWorker().postMessage({
			buffer: buffer,
			blocks: this.blocks,
			bgs: this.bgs,
			lighting: this.lighting,
			day: this.client.day,
			i: {
				x: this.x,
				y: this.y,
				buffer: buffer
			},
			bs: BLOCKSIZE
		}, [buffer]);
		this.sfdirty = null;
	}
}

self.DustClientCommands = {
	handshake: function(msg, client) {
		client.serverName = msg.serverName;
		client.send({cmd: 'haveData', playerName: 'Bob'});
	},
	
	loadWorld: function(msg, client) {
		client.chat("Connected to " + client.serverName, 'yellow');
		client.connected = true;
	},
	
	disconnect: function(msg, client) {
		client.chat("DISCONNECTED: " + msg.reason, 'yellow');
	},
	
	message: function(msg, client) {
		client.chat(msg.text, msg.color);
	},
	
	haveChunk: function(msg, client) {
		const chunk = new DustClientChunk(msg.x, msg.y, msg.blocks, msg.bgs, client);
		
		for (var i = 0; i < client.chunks.length; i++) {
			if (client.chunks[i].x === msg.x && client.chunks[i].y === msg.y) {
				client.chunks[i] = chunk;
				return;
			}
		}
			
		client.chunks.push(chunk);
	},
	
	setBlock: function(msg, client) {
		const ch = client.getChunk(msg.chx, msg.chy);
		if (ch && ch.isChunkObject) ch.setBlock(msg.blk, msg.ind);
	},
	
	pan: function(msg, client) {
		client.camx = BLOCKSIZE * msg.x;
		client.camy = BLOCKSIZE * msg.y;
	}
};

class DustClient {
	
	constructor(cvs) {
		this.kcmap = {
			37: 'left',
			38: 'up',
			39: 'right',
			40: 'down',
			32: 'jump',
			16: 'run',
			84: 'chat',
			191: 'cmd'
		};
	
		this.displayChunkBoundries = false;

		this.bgcolor = [0,255,255];
	
		this.chunks = [];
	
		this.dirtychunks = 1;
	
		this.cvs = cvs;
	
		this.camx = 0;
		this.camy = 0;
	
		this.day = true;

		this.updateCanvas();

		this.chat_hist = [];
		this.chatEl = document.createElement('input');
		this.chatEl.setAttribute('type', 'text');
		this.chatEl.style.position = 'fixed';
		this.chatEl.style.bottom = '20px';
		this.chatEl.style.left = '32px';
		this.chatEl.style.width = '512px';
		this.chatEl.style.color = 'white';
		this.chatEl.style['background-color'] = 'rgba(0,0,0,0.6)';
		this.chatEl.style.border = 'none';
		this.chatEl.style.display = 'none';
		this.chatEl.addEventListener('blur', e => {
			this.closeChat();
		});
		this.chatEl.addEventListener('keydown', e => { e.stopPropagation(); });
		this.chatEl.addEventListener('keyup',   e => { e.stopPropagation(); });
		this.chatEl.addEventListener('keypress',e => {
			if (e.keyCode === 27) {
				this.closeChat();
			}

			if (e.keyCode === 10 || e.keyCode === 13) {
				this.say(this.chatEl.value);
				this.closeChat();
			}
		});
		document.body.appendChild(this.chatEl);
	
		this.renderWorker = new Worker('worker.js');
		this.renderWorker.postMessage('client/chunkRenderWorker.js');
		this.renderWorker.onmessage = msg => {
			this.getChunk(msg.data.x, msg.data.y).uds(msg.data.buffer);
		};

		let drawMe;
		drawMe = () => {
			this.render();
			requestAnimationFrame(drawMe);
		};
		
		setInterval(() => {
			if (!client.connected) return;
			const chx = 0|(this.camx / (128 * BLOCKSIZE));
			const chy = 0|(this.camy / (128 * BLOCKSIZE));
			for (let i = -3; i < 3; i++) {
				for (let j = -2; j < 3; j++) {
					if (this.getChunk(i + chx, j + chy) === null) {
						this.chunks.push({x: i + chx, y: j + chy});
						this.send({cmd: 'getChunk', x: i + chx, y: j + chy});
					}
				}
			}

			for (let i = this.chunks.length - 1; i >= 0; i--) {
				const ch = this.chunks[i];
				if (Math.max(Math.abs(chx - ch.x), Math.abs(chy - ch.y)) >= 7) {
					this.chunks.splice(i, 1);
				}
			}
		}, 256);
		
		requestAnimationFrame(drawMe);
		
		document.addEventListener('keydown', e => {
			let pd = true;
			if (this.kcmap[e.keyCode] === 'chat')
				setTimeout(() => { this.openChat(); }, 16);
			else if (this.kcmap[e.keyCode] === 'cmd')
				setTimeout(() => { this.openChat(); this.chatEl.value = '/'; }, 16);
			else if (e.keyCode in this.kcmap)
				this.send({cmd: 'updateKey', key: this.kcmap[e.keyCode], down: true});
			else pd = false;

			if (pd) e.preventDefault();
		});
		
		document.addEventListener('keyup', e => {
			if (e.keyCode in this.kcmap) this.send({cmd: 'updateKey', key: this.kcmap[e.keyCode], down: false});
		});
	}
	
	getChunk(x, y) {
		for (const chunk of this.chunks) 
			if (chunk.x === x && chunk.y === y)
				return chunk;
		
		return null;
	}
	
	getBlock(x, y) {
		const ch = this.getChunk(Math.floor(x / 128), Math.floor(y / 128));
		if (ch instanceof DustClientChunk) {
			return ch.blocks[(y&127) + 128 * (x&127)];
		} else {
			return DustDataBlocks.ERROR.id;
		}
	}
	
	setDay(day) {
		if (day ^ this.day) {
			this.day = day;
			for (const ch of this.chunks) {
				if (ch.y < 3) {
					ch.sfdirty = [0,0,128,128];
				}
			}
		}
	}

	updateCanvas() {
		this.sf = CreateCanvasObject(this.cvs);
	}
	
	onmsg(msg) {
		DustClientCommands[msg.cmd](msg, this);
	}
	
	chat(msg, clr) {
		this.chat_hist.push({message: msg, color: clr || 'white', timestamp: Date.now()});
		if (this.chat_hist.length > 16) this.chat_hist.splice(0,1);
	}

	say(msg) {
		this.send({cmd: 'chat', text: msg})
	}

	openChat() {
		this.chatEl.style.display = 'block';
		this.chatEl.value = '';
		this.chatEl.focus();
	}

	closeChat() {
		this.chatEl.style.display = 'none';
		this.chatEl.blur();
	}

	getRenderWorker() {
		return this.renderWorker;
	}

	render() {
		this.sf.clear();
		this.dirtychunks = 0;
		for (const chunk of this.chunks) {
			
			if (!(chunk instanceof DustClientChunk)) continue;
			
			if (chunk.sfdirty) chunk.render();

			this.sf.blit([Math.floor(chunk.x * 128 * BLOCKSIZE - this.camx + this.sf.width / 2),
			              Math.floor(chunk.y * 128 * BLOCKSIZE - this.camy + this.sf.height/ 2)], chunk.sf);

			if (this.displayChunkBoundries) {
				this.sf.drawRect([0|(chunk.x * 128 * BLOCKSIZE - this.camx + this.sf.width / 2),
				                  0|(chunk.y * 128 * BLOCKSIZE - this.camy + this.sf.height/ 2),
				                  128 * BLOCKSIZE, 1], 'blue');

				this.sf.drawRect([0|(chunk.x * 128 * BLOCKSIZE - this.camx + this.sf.width / 2),
				                  0|(chunk.y * 128 * BLOCKSIZE - this.camy + this.sf.height/ 2),
				                  1, 128 * BLOCKSIZE], 'blue');
			}
		}
		
		this.sf.drawRect([0|(this.sf.width / 2 - BLOCKSIZE * 3), 0|(this.sf.height / 2 - BLOCKSIZE * 7), BLOCKSIZE * 6, BLOCKSIZE * 14], 'red');
		
		this.renderChat();
	}
	
	renderChat() {
		let y = this.sf.height - 64;
		
		for (let i = this.chat_hist.length - 1; i >= Math.max(0, this.chat_hist.length - 5); i--) {
			const m = this.chat_hist[i];
			
			if (Date.now() - m.timestamp < 7000) {
				this.sf.drawRect([30,y-16,512,20], 'rgba(0,0,0,0.6)');
				this.sf.drawText([32,y], m.message, '16px Arial', m.color);
				y -= 20;
			}
		}
	}
	
	addLighting(x, y, al) {
		const ch = this.getChunk(Math.floor(x / 128), Math.floor(y / 128));
		if (ch instanceof DustClientChunk) {
			ch.lighting[(y&127) + 128 * (x&127)] += al;
			ch.dirtyBlock(x&127, y&127);
		}
	}
	
}

self.DustClientUtils = {
	byteclamp: function(x) {
		return 0|(x < 0 ? 0 : (x > 255 ? 255 : x));
	}
}
