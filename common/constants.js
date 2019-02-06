m_supplies('common/constants.js');

self.DustDataBlocks = {
	
	void: {
		id: 0,
		render: 'none',
		physics: 'fluid',
		density: 0.00123
	},
	
	silicate_rock: {
		id: 1,
		color: [187, 187, 187],
		render: 'normal',
		variation: 7,
		physics: 'solid',
		bounciness: 0.05,
		friction: 0.9999
	},
	
	dirt: {
		id: 2,
		color: [87,59,12],
		render: 'normal',
		variation: 16,
		physics: 'solid',
		bounciness: 0.1,
		friction: 1
	},
	
	grass: {
		id: 3,
		color: [0,123,12],
		render: 'normal',
		variation: 10,
		physics: 'solid',
		bounciness: 0.3,
		friction: 1
	},
	
	silica_sand: {
		id: 4,
		color: [255,236,172],
		render: 'normal',
		variation: 3,
		physics: 'solid',
		bounciness: 0,
		friction: 1
	},
	
	salt_water: {
		id: 5,
		color: [0,48,80],
		render: 'fluid',
		physics: 'fluid',
		density: 0.9
	},

	coal: {
		id: 6,
		color: [8,8,8],
		render: 'normal',
		variation: 7,
		physics: 'solid',
		bounciness: 0.03,
		friction: 0.99995
	},

	tree_root: {
		id: 7,
		color: [64,56,49],
		render: 'normal',
		variation: 13,
		physics: 'solid',
		bounciness: 0.1,
		friction: 1
	},

	pine_wood: {
		id: 8,
		color: [65,40,40],
		render: 'normal',
		variation: 15
	},

	pine_leaf: {
		id: 9,
		color: [44,54,39],
		render: 'normal',
		variation: 12
	},

	////////////////////////////////////////////////////////////////
	
	gracilaria: {
		id: 100,
		color: [224,68,17],
		render: 'normal',
		variation: 12
	},
	
	green_fungal_wall: {
		id: 101,
		color: [40,80,40],
		render: 'normal',
		variation: 4
	},
	
	sun_stone: {
		id: 102,
		color: [255,255,222],
		render: 'normal',
		light: 1
	},

	flower_stem: {
		id: 103,
		color: [0,151,16],
		render: 'normal',
		variation: 3
	},

	red_petal: {
		id: 104,
		color: [170,12,4],
		render: 'normal',
		variation: 5
	},

	orange_petal: {
		id: 105,
		color: [200,100,1],
		render: 'normal',
		variation: 5
	},

	yellow_petal: {
		id: 106,
		color: [220,210,2],
		render: 'normal',
		variation: 5
	},

	violet_petal: {
		id: 107,
		color: [80,1,160],
		render: 'normal',
		variation: 5
	},

	white_petal: {
		id: 108,
		color: [242,240,240],
		render: 'normal',
		variation: 2
	},

	surfgrass: {
		id: 109,
		color: [12,90,0],
		render: 'normal',
		variation: 8
	},

	////////////////////////////////////////////////////////////////
	
	luciferin: {
		id: 1000,
		color: [80,255,80],
		render: 'normal',
		light: 0.025
	},

	////////////////////////////////////////////////////////////////
	
	ERROR: {
		id: 65535,
		color: [150,0,150],
		render: 'normal'
	}
};

self.DustDataBgs = {

	void: {
		id: 0,
		render: 'none'
	},

	rock: {
		id: 1,
		color: [90, 90, 90],
		variation: 5,
		render: 'normal'
	},

	////////////////////////////////////////////////////////////////

	ERROR: {
		id: 65535,
		color: [150,0,150],
		render: 'normal'
	}
};

!function() {
	var blocks = [];
	for (var block in DustDataBlocks) {
		blocks.push(DustDataBlocks[block]);
	}
	for (var i = 0; i < blocks.length; i++) {
		DustDataBlocks[blocks[i].id] = blocks[i];
	}
	var bgs = [];
	for (var bg in DustDataBgs) {
		bgs.push(DustDataBgs[bg]);
	}
	for (var bg of bgs) {
		DustDataBgs[bg.id]=bg
	}
}();
