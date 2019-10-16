m_supplies('server/server.js');
//m_require('server/generators.js');
m_require('common/constants.js');

self.DustServerCommands = {
	getChunk: async function(msg, svr, conn) {
		const chunk = await svr.getChunkGen(msg.x, msg.y);
		while (chunk.age < 4) await svr.nextTick();
		conn.send({cmd: 'haveChunk', x: msg.x, y: msg.y, blocks: chunk.blocks.slice(), bgs: chunk.bgs.slice()});
	},
	chat: function(msg, svr, conn) {
		if (msg.text.startsWith('/')) {
			var res = svr.runCommand(msg.text.split(' ').filter(x => !!x), conn.player);
			conn.send({cmd: 'message', text: res, color: res.startsWith('[EE]') ? 'red' : 'gray'});
		} else {
			svr.players.forEach(function(plr) {
				if (plr.online) plr.conn.send({cmd: 'message', text: '<' + conn.player.username + '> ' + msg.text});
			});
		}
	},
	updateKey: function(msg, svr, conn) {
		conn.player.keys[msg.key] = msg.down;
	}
};

class DustServer {
	
	constructor(properties) {
		properties = properties || {};
	
		this.name = properties.name || "Dust Server";

		this.seed = properties.seed || Math.random() + ';' + Math.random();
		
		this.gen_listeners = {};
		this.generation_worker = new Worker('worker.js');
		this.generation_worker.postMessage('server/generationWorker.js');
		this.generation_worker.postMessage(`new DustServerGenerators[${ JSON.stringify(properties.generator) }](${ JSON.stringify(this.seed) })`);
		this.generation_worker.onmessage =msg => {
			this.gen_listeners[msg.data.key](msg.data.value);
			delete this.gen_listeners[msg.data.key];
		};

		this.gravity = properties.gravity || 275;

		this.players = [];

		this.entities = [];

		this.chunks = {};

		this.cmdVars = {};

		this.tickPromises = [];

		//for (let i = -8; i < 8; i++) for (let j = -8; j < 8; j++) this.getChunk(i, j);
		
		setInterval(() => this.tick(), 10);
	}

	addConnection(conn) {
		const svr = this;
		conn.onmsg = function(msg) {
			if (msg.cmd !== 'haveData') {
				this.disconnect('Unable to perform handshake: You have no hands.');
				return;
			}
			var player = new DustServerPlayer(svr, msg.playerName);
			svr.players.push(player);
			svr.entities.push(player);
			this.player = player;
			player.connect(this);
			this.send({cmd: 'loadWorld'});
			
			this.onmsg = function(msg) {
				DustServerCommands[msg.cmd](msg, svr, this);
			};
		}
		
		conn.send({cmd: 'handshake', serverName: this.name});
	}

	getPlayer(name) {
		for (const plr of this.players) {
			if (plr.username === name) {
				return plr;
			}
		}

		return null;
	}
	
	async getChunkGen(x, y) {
		const key = x + ',' + y;
		
		if (this.chunks[key]) return this.chunks[key];

		this.generation_worker.postMessage([x,y,key]);
		return this.chunks[key] = new DustServerChunk(this, x, y, await new Promise((resolve, reject) => (this.gen_listeners[key] = resolve)));
	}

	getChunk(x, y) {
		return this.chunks[x + ',' + y];
	}
	
	getBlock(x, y) {
		const chunk = this.getChunk(Math.floor(x / 128), Math.floor(y / 128));
		if (chunk) {
			return this.getChunk(Math.floor(x / 128), Math.floor(y / 128)).blocks[(y & 127) + 128 * (x & 127)];
		} else {
			return 65535;
		}
	}
	
	setBlock(x, y, blk) {
		const chunk = this.getChunk(Math.floor(x / 128), Math.floor(y / 128));
		const blocki = (y & 127) + 128 * (x & 127);
		chunk.blocks[blocki] = blk;
		for (const plr of this.players) {
			if (plr.online) plr.conn.send({cmd: 'setBlock', chx: chunk.x, chy: chunk.y, ind: blocki, blk: blk});
		}
	}

	nextTick() {
		return new Promise(resolve => this.tickPromises.push(resolve));
	}
	
	tick() {
		for (let i = this.entities.length - 1; i > -1; i--) {
			if (this.entities[i].tick(0.01)) {
				this.entities.splice(i, 1);
			}
		}

		for (const chunk_pos in this.chunks) {
			const chunk = this.chunks[chunk_pos];
			chunk.tick();
		}

		for (const promise of this.tickPromises) {
			promise();
		}

		this.tickPromises = [];
	}

	runCommand(command, user) {
		const commands = {
			'/': {
				args: 1,
				func: args => {
					return args[0].run();
				}
			},
			'/noclip': {
				args: 0,
				func: args => {
					if (user) {
						return (user.noclip = !user.noclip) ? "Noclip enabled." : "Noclip disabled.";
					} else throw("/noclip: Not beng run as user.");
				}
			},
			'/setblock': {
				args: 3,
				func: args => {
					let x = args[0].run();
					let y = args[1].run();
					let b = args[2].run();

					if (isNaN(+x) || (+x) % 1 !== 0) {
						throw("/setblock: " + x + " is not a valid integer.");
					}

					if (isNaN(+y) || (+y) % 1 !== 0) {
						throw("/setblock: " + y + " is not a valid integer.");
					}

					if (b in DustDataBlocks) {
						b = DustDataBlocks[b];
					} else {
						throw("/setblock: " + b + " is not a valid block");
					}

					x = +x;
					y = +y;

					this.setBlock(x, y, b.id);

					return "1 block updated.";
				}
			},
			'/tpc': {
				args: 3,
				func: args => {
					let p = args[0].run().split(',');
					let x = args[1].run();
					let y = args[2].run();

					if (isNaN(+x)) {
						throw("/tpc: " + x + " is not a valid number.");
					}

					if (isNaN(+y)) {
						throw("/tpc: " + y + " is not a valid number.");
					}

					x = +x;
					y = +y;

					p = p.map(x => {
						const plr = this.getPlayer(x);
						if (!plr) {
							throw("/tpc: " + x + " is not a valid player.");
						}
						return plr;
					});

					for (const plr of p) {
						plr.x = x;
						plr.y = y;
					}

					return p.length + " player(s) moved."
				}
			},
			'/whoami': {
				args: 0,
				func: args => {
					if (user) {
						return user.username;
					} else throw("/whoami: Not being run as user.");
				}
			}
		}

		let next;
		next = () => {
			
			const me = this;

			if (command.length === 0) {
				throw("Not enough arguments passed to command.");
			}

			const cmd = command.splice(0, 1)[0];

			if (cmd.startsWith('/')) {
				if (cmd in commands) {
					let args = [];
					for (var i = 0; i < commands[cmd].args; i++) {
						args.push(next());
					}

					return {a: args, f: commands[cmd].func, run: function() {return this.f(this.a);}};
				} else throw(cmd + " is not a valid command.");
			} else if (cmd.startsWith('$')) {
				if (cmd.endsWith('=')) {
					return {run: function() {return me.cmdVars[cmd.substring(0, cmd.length-1)] = this.a.run()}, a: next()};
				} else {
					return {run: () => me.cmdVars[cmd] || ''};
				}
			} else {
				return {run: () => cmd};
			}
		}
		
		try {
			const root = next();
			if (command.length) {
				throw("Too many arguments passed to command");
			}

			return '[II] ' + root.run();
		} catch (e) {
			return '[EE] ' + e;
		}
	}	
}

class DustServerChunk {
	constructor(svr, x, y, genf) {
		this.svr = svr;
	
		this.age = 0;

		this.x = x;
		this.y = y;
	
		if (genf.fill) {
			this.blocks = genf[0];
			this.bgs = genf[1];
		} else {
			this.blocks = Array(16384).fill(DustDataBlocks.ERROR.id);
			this.bgs = Array(16384).fill(DustDataBgs.ERROR.id);

			if (genf) genf.generateChunk(this);
		}
	}

	tick() {
		this.age++;
	}
}

class DustServerConnection {
	constructor() {
		this.toBeDeleted = false;
		this.player = null;
	}
	
	disconnect(rs) {
		this.send({cmd: 'disconnect', reason: rs});
		this.toBeDeleted = true;
		this.player.online = false;
	}
}

class DustServerPlayer {
	constructor(svr, name) {
		this.username = name;
		this.online = false;
		this.conn = null;
		this.svr = svr;
		this.keys = {
			left: false,
			right: false,
			up: false,
			down: false,
			jump: false,
			run: false
		};

		this.x = 0;
		this.y = -150;
		this.dx = 0;
		this.dy = 0;
		this.hcolwidth = 3;
		this.hcolheight = 7;

		this.jumppwr = 100;

		this.noclip = false;
	}

	connect(conn) {
		this.online = true;
		this.conn = conn;
	}
		
	tick(dtime) {

		const ix = Math.floor(this.x);
		const iy = Math.floor(this.y);
		
		if (this.noclip) {
			this.x += dtime * (this.keys.left * -50 + this.keys.right * 50) * (1 + this.keys.run);
			this.y += dtime * (this.keys.up   * -50 + this.keys.down  * 50) * (1 + this.keys.run);
		} else {
			const dxofs = (this.keys.left * -30 + this.keys.right * 30) * (1 + this.keys.run);	
			
			this.dy += this.svr.gravity * dtime;
			
			let friction = 0;
			
			if (this.dy > 0) {
				let tsol = 0;
				let bounce = 0;
				
				for (let i = ix - this.hcolwidth; i <= ix + this.hcolwidth; i++) {
					const blk = DustDataBlocks[this.svr.getBlock(i, iy + this.hcolheight)];
					if (blk.physics === 'solid') {
						bounce += blk.bounciness || 0;
						friction += blk.friction || 1;
						tsol++;
					}
				}
				
				if (tsol) {
					this.dy *= bounce /- tsol;
					if (Math.abs(this.dy) < 30) this.dy = 0;
					
					if (this.keys.jump) this.dy -= this.jumppwr;
					
					friction /= tsol;
				}
			}
			
			if (this.dy < 0) {
				let tsol = 0;
				let bounce = 0;
				
				for (let i = ix - this.hcolwidth; i <= ix + this.hcolwidth; i++) {
					const blk = DustDataBlocks[this.svr.getBlock(i, iy - this.hcolheight)];
					if (blk.physics === 'solid') {
						bounce += blk.bounciness || 0;
						tsol++;
					}
				}
				
				if (tsol) {
					this.dy *= bounce /- tsol;
				}
			}
			
			if (friction > 1) friction = 1;
			
			if (friction < 0.7) friction = 0.7;

			this.dx = (this.dx - dxofs) * Math.pow(1 - friction, dtime) + dxofs;
			
			if (this.dx > 0) {
				for (let i = iy - this.hcolheight; i < iy + this.hcolheight - 1; i++) {
					const blk = DustDataBlocks[this.svr.getBlock(ix + this.hcolwidth, i)];
					if (blk.physics === 'solid') {
						this.dx = 0;
						break;
					}
				}

				if (this.dx > 0 && DustDataBlocks[this.svr.getBlock(ix + this.hcolwidth, iy + this.hcolheight - 1)].physics === 'solid') {
					for (let i = ix - this.hcolwidth; i <= ix + this.hcolwidth; i++) {
						const blk = DustDataBlocks[this.svr.getBlock(i, iy - this.hcolheight)];
						if (blk.physics === 'solid') {
							this.dx = 0;
							break;
						}
					}

					if (this.dx > 0) {
						this.y -= 1;
					}
				}
			}

			else if (this.dx < 0) {
				for (let i = iy - this.hcolheight; i < iy + this.hcolheight - 1; i++) {
					const blk = DustDataBlocks[this.svr.getBlock(ix - this.hcolwidth - 1, i)];
					if (blk.physics === 'solid') {
						this.dx = 0;
						break;
					}
				}
				
				if (this.dx < 0 && DustDataBlocks[this.svr.getBlock(ix - this.hcolwidth - 1, iy + this.hcolheight - 1)].physics === 'solid') {
					for (let i = ix - this.hcolwidth; i <= ix + this.hcolwidth; i++) {
						const blk = DustDataBlocks[this.svr.getBlock(i, iy - this.hcolheight)];
						if (blk.physics === 'solid') {
							this.dx = 0;
							break;
						}
					}

					if (this.dx < 0) {
						this.y -= 1;
					}
				}
			}

			this.x += this.dx * dtime;
			this.y += this.dy * dtime;
		}

		if (this.online) {
			this.conn.send({cmd: 'pan', x: ix, y: iy});
		}
	}
}


self.onmessage = function(message) {
	self.server_object = new DustServer(message.data);
	self.connection = new DustServerConnection();

	self.connection.send = function(message) {
		self.postMessage(message);
	};

	self.onmessage = function(message) {
		self.connection.onmsg(message.data);
	};

	self.server_object.addConnection(self.connection);
};
