m_supplies('server/generators.js');
m_require('lib/perlin.js');
m_require('common/constants.js');

class StructureBuilder {
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.content = {};
	}

	set(x, y, b) {
		this.content[`${x},${y}`] = b;
	}

	build() {
		let content = [];
		for (const pos in this.content) {
			const s = pos.indexOf(',');
			const x = +pos.substring(0, s);
			const y = +pos.substring(s + 1);
			content.push(x);
			content.push(y);
			content.push(this.content[pos]);
		}

		return {root: [this.x, this.y], content: content};
	}
}

class DustServerWorldGenerator {
	constructor(seed) {
		if (this.constructor === DustServerWorldGenerator)
			throw new TypeError('Illegal constructor');

		this.seed = seed;
	}

	// required: generateChunk(DustServerChunk chunk)
}

class DustServerWorldGeneratorFlat0 extends DustServerWorldGenerator {
	generateChunk(chunk) {
		chunk.blocks.fill( chunk.y < 0 ? DustDataBlocks.void.id : DustDataBlocks.silicate_rock.id );
		chunk.bgs.fill( chunk.y < 0 ? DustDataBgs.void.id : DustDataBgs.rock.id );
	}
}

const DustServerWorldGeneratorBasicStructureFrequencyData = {
	ocean: [
		{
			n: 'Gracilaria',
			f: (depth, grad, temp, _) => depth > 8 && depth < 200 && Math.abs(grad) < 0.6 ? 0.005 : 0
		},
		{
			n: 'Surfgrass',
			f: (depth, grad, _, __) => depth > 5 && depth < 150 && Math.abs(grad) < 0.2 ? 0.4 : 0
		}
	],
	beach: [],
	land: [
		{
			n: 'PineTree',
			f: (_, grad, temp, humidity) => (temp > -2 && temp < 30 && Math.abs(grad) < 0.8) ? 0.03 : 0
		},
		{
			n: 'LargeFlower',
			f: (_, grad, temp, humidity) => Math.abs(grad) < 0.5 ? 0.02 : 0
		},
		{
			n: 'SmallFlower',
			f: (_, grad, temp, humidity) => Math.abs(grad) < 1.3 ? 0.1 : 0
		}
	]
};

class DustServerWorldGeneratorBasic extends DustServerWorldGenerator {
	constructor(seed) {
		super(seed);

		this.perlins = {};

		this.structureCache = {};
	}
	
	generateChunk(chunk) {
		for (let x = 0; x < 128; x++) {
			const rx = x + 128 * chunk.x;
			const d = this.x2depth(rx);
			for (let y = 0; y < 128; y++) {
				const ry = y + 128 * chunk.y;
				
				chunk.blocks[128 * x + y] = (
					ry > d
					? (
						ry > d + 4
						? (
							ry > d + 96
							? this.oreAt(rx, ry)
							: DustDataBlocks.dirt.id
						)
						: (
							d > -32
							? DustDataBlocks.silica_sand.id
							: DustDataBlocks.grass.id
						)
					)
					: (
						ry > 0
						? DustDataBlocks.salt_water.id
						: DustDataBlocks.void.id
					)
				);

				chunk.bgs[128 * x + y] = ry > d + 96 ? DustDataBgs.rock.id : DustDataBgs.void.id;
			}
		}

		for (let i = -2; i < 3; i++) {
			for (let j = -2; j < 3; j++) {
				for (const structure of this.getStructuresForChunk(i + chunk.x, j + chunk.y)) {
					const rootx = structure.root[0];
					const rooty = structure.root[1];
					
					for (let b = 0; b < structure.content.length; b += 3) {
						const bx = rootx + structure.content[b] - chunk.x * 128;
						const by = rooty + structure.content[1+b] - chunk.y * 128;
						const block = structure.content[2+b];
						if (bx >= 0 && bx < 128 && by >= 0 && by < 128) {
							chunk.blocks[128 * bx + by] = block;
						}
					}
				}
			}
		}
	}

	perlin(id) {
		id = ''+id;
		return (id in this.perlins) ? this.perlins[id] : (this.perlins[id] = new Perlin(id + this.seed));
	}	
	
	x2depth(x) {
		const f = 3e6, q = 3e5;
		let d = 0;
		d += (0.5 - this.perlin(1).noise(x / (f >> 0), 42, 42)) * (q >> 0);
		d += (0.5 - this.perlin(2).noise(x / (f >> 2), 42, 42)) * (q >> 2);
		d += (0.5 - this.perlin(3).noise(x / (f >> 4), 42, 42)) * (q >> 4);
		d += (0.5 - this.perlin(4).noise(x / (f >> 6), 42, 42)) * (q >> 6);
		d += (0.5 - this.perlin(5).noise(x / (f >> 8), 42, 42)) * (q >> 8);
		d += (0.5 - this.perlin(6).noise(x / (f >> 10), 42, 42)) * (q >> 10);
		d += (0.5 - this.perlin(7).noise(x / (f >> 12), 42, 42)) * (q >> 12);
		return 0|d;
	}

	x2grad(x) {
		return (this.x2depth(x+6) - this.x2depth(x-6)) / 12;
	}

	oreAt(x, y) {
		return (
			this.perlin('coal').noise(x / 90, y / 50, 42) > 0.8
			? DustDataBlocks.coal.id
			: DustDataBlocks.silicate_rock.id
		);
	}

	getStructuresForChunk(x, y) {
		const key = `${x},${y}`;
		if (key in this.structureCache) return this.structureCache[key];
		else return this.structureCache[key] = this.getStructuresForChunk_(x, y);
	}

	getStructuresForChunk_(x, y) {
		let structures = [];

		for (let i = 0; i < 128; i++) {
			const rx = i + 128 * x;
			const depth = this.x2depth(rx);
			
			if (depth >= y * 128 && depth < (1 + y) * 128) {
				// This is the surface.
				const grad = this.x2grad(rx);
				if (depth < -32) {
					// Land.
					for (const str of DustServerWorldGeneratorBasicStructureFrequencyData.land) {
						if (Math.random() < str.f(depth, grad, 1, 1)) {
							 structures.push(this[`generateStructure${ str.n }`](rx, depth));
							 break;
						}
					} 
				} else if (depth < 0) {
					// Beach.
					for (const str of DustServerWorldGeneratorBasicStructureFrequencyData.beach) {
						if (Math.random() < str.f(depth, grad, 1, 1)) {
							 structures.push(this[`generateStructure${ str.n }`](rx, depth));
							 break;
						}
					} 
				} else {
					// Ocean.
					for (const str of DustServerWorldGeneratorBasicStructureFrequencyData.ocean) {
						if (Math.random() < str.f(depth, grad, 1, 1)) {
							 structures.push(this[`generateStructure${ str.n }`](rx, depth));
							 break;
						}
					} 
				}
			}
		}

		return structures;
	}

	createRoots(struct, width) {
		const root = DustDataBlocks.tree_root.id;

		function createRootBranch(px, py, pd, st) {
			while (st > 0) {
				struct.set(0|px, 0|py, root);
				px += Math.sin(pd);
				py += Math.cos(pd);
				if (px > 125 || px < -125 || py > 125) break;
				pd += 0.4 * (Math.random() - 0.5);
				if (pd > 1.5)  pd = 1.5;
				if (pd < -1.5) pd = -1.5;
				if (st > 10 && Math.random() < 0.13) {
					const split = Math.random() * 0.8 + 0.1;
					createRootBranch(px, py, pd - 0.1, 0|(st * split));
					createRootBranch(px, py, pd + 0.1, 0|(st * (1 - split)));
					return;
				}
				st--;
			}
		}
		
		for (let sx = 0|(width / -2); sx < width + (0|(width / -2)); sx++) {
			createRootBranch(sx, 0, Math.random() * 1.4 - 0.7, 300);
		} 
	}

	generateStructurePineTree(x, y) {
		let struct = new StructureBuilder(x, y);
		const width = 5;
		this.createRoots(struct, width);

		const height = 150 + Math.floor(Math.random() * 100);

		for (let i = 1; i < height; i++) {
			for (let x = 0|(width / -2); x < width + (0|(width / -2)); x++) {
				struct.set(x, -i, DustDataBlocks.pine_wood.id);
			}
		}

		let s = 1;
		for (let i = 10 + (0|(40 * Math.random())); i < height; i += 2 + Math.floor(Math.random() * 2)) {
			s = -s;
			const l = 12 + Math.floor(Math.random() * 40 - Math.floor(i / height * 30));
			const dy = Math.random() * -0.1 - 0.2;
			let y = -i;
			let na = -2, nb = -2;
			for (let j = 0; j < l; j++) {
				struct.set(j * s, y|0, DustDataBlocks.pine_wood.id);
				if (na++ > 0 && Math.random() > 0.5) {
					na = 0;
					struct.set(j * s, (y|0) - 1, DustDataBlocks.pine_leaf.id);
					struct.set(j * s, (y|0) - 2, DustDataBlocks.pine_leaf.id);
					if (j / l < Math.random()) {
						struct.set((j + 1) * s, (y|0) - 3, DustDataBlocks.pine_leaf.id);
						struct.set((j + 1) * s, (y|0) - 4, DustDataBlocks.pine_leaf.id);
					}
				}
				if (nb++ > 0 && Math.random() > 0.5) {
					nb = 0;
					struct.set(j * s, (y|0) + 1, DustDataBlocks.pine_leaf.id);
					struct.set(j * s, (y|0) + 2, DustDataBlocks.pine_leaf.id);
					if (j / l < Math.random()) {
						struct.set((j + 1) * s, (y|0) + 3, DustDataBlocks.pine_leaf.id);
						struct.set((j + 1) * s, (y|0) + 4, DustDataBlocks.pine_leaf.id);
					}
				}
				y += dy;
			}
		}

		return struct.build();
	}

	generateStructureSmallFlower(x, y) {
		const petal = [DustDataBlocks.red_petal.id,
        			   DustDataBlocks.orange_petal.id,
        			   DustDataBlocks.yellow_petal.id,
        			   DustDataBlocks.violet_petal.id,
        			   DustDataBlocks.white_petal.id] [0|(Math.random() * 5)];

		let content = [0, 0, DustDataBlocks.flower_stem.id, 0, -1, DustDataBlocks.flower_stem.id, 0, -2, petal];

		if (Math.random() > 0.9) {
			content[8] = DustDataBlocks.flower_stem.id;
			content.push(0);
			content.push(-3);
			content.push(petal);
		}

		return {
			root: [x, y],
			content: content
		};
	}

	generateStructureLargeFlower(x, y) {
		const petal = [DustDataBlocks.red_petal.id,
        			   DustDataBlocks.orange_petal.id,
        			   DustDataBlocks.violet_petal.id,
        			   DustDataBlocks.white_petal.id] [0|(Math.random() * 4)];
		
		let content = [];

		const h1 = 4 + (0|(Math.random() * 3));
		const h2 = 3 + (0|(Math.random() * (h1 - 3)));
		const sway = Math.random() > 0.5 ? -1 : 1;

		for (let i = 0; i < h1; i++) {
			content.push(0);
			content.push(-i);
			content.push(DustDataBlocks.flower_stem.id);
		}

		for (let i = 0; i < h2; i++) {
			content.push(sway);
			content.push(-h1-i);
			content.push(DustDataBlocks.flower_stem.id);
		}

		content.push(sway);
		content.push(-h1-h2-1);
		content.push(DustDataBlocks.yellow_petal.id);
		content.push(sway);
		content.push(-h1-h2);
		content.push(petal);
		content.push(sway);
		content.push(-h1-h2-2);
		content.push(petal);
		content.push(sway-1);
		content.push(-h1-h2);
		content.push(petal);
		content.push(sway-1);
		content.push(-h1-h2-1);
		content.push(petal);
		content.push(sway-1);
		content.push(-h1-h2-2);
		content.push(petal);
		content.push(sway+1);
		content.push(-h1-h2);
		content.push(petal);
		content.push(sway+1);
		content.push(-h1-h2-1);
		content.push(petal);
		content.push(sway+1);
		content.push(-h1-h2-2);
		content.push(petal);

		return {
			root: [x, y],
			content: content
		};
	}

	generateStructureGracilaria(x, y) {
		let content = [];

		let sources = [[0, 0]];
		let new_sources = [];

		let rd = 0;

		while (sources.length) {
			if (-sources[0][1] > y - 5) break;

			for (const source of sources) {
				content.push(source[0]);
				content.push(source[1]);
				content.push(DustDataBlocks.gracilaria.id);

				const p = 1 - 0.02 * rd;

				if (Math.random() < 0.3 * p) new_sources.push([source[0], source[1] - 1]);
				else {
					if (Math.random() < 0.7 * p) new_sources.push([source[0] - 1, source[1] - 1]);
					if (Math.random() < 0.7 * p) new_sources.push([source[0] + 1, source[1] - 1]);
				}
			}

			for (let i = new_sources.length - 1; i > 0; i--) {
				for (let j = 0; j < i; j++) {
					if (''+new_sources[i] === ''+new_sources[j]) {
						new_sources.splice(i, 1);
						break;
					}
				}
			}

			sources = new_sources;
			new_sources = [];

			rd++;
		}

		return {
			root: [x, y],
			content: content
		};
	}

	generateStructureSurfgrass(x, y) {
		let h = 0;

		let content = [];
		let py = 0;

		const sway = Math.random() > 0.5 ? -1 : 1;

		do {
			const segh = Math.random() > 0.5 ? 3 : 4;
			for (let i = 0; i < segh; i++) {
				content.push(sway * (h & 1));
				content.push(py--);
				content.push(DustDataBlocks.surfgrass.id);
			}
		} while (Math.random() > 0.5 && h++ < 4 && y + py > 5);

		return {
			root: [x, y],
			content: content
		};
	}
}

self.DustServerGenerators = {
	flat0: DustServerWorldGeneratorFlat0,
	basic: DustServerWorldGeneratorBasic
};
