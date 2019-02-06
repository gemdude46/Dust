self.LOADED_MODULES = [];

function m_get(path) {
	const request = new XMLHttpRequest();
	request.open('GET', path, false);
	request.send(null);
	
	if (request.status === 200) {
		return request.responseText;
	} else {
		throw new Error(`Unable to load module '${ path }': returned status ${ request.status }`);
	}
}

function m_supplies(module_path) {
	self.LOADED_MODULES.push(module_path);
}

function m_require(module_path) {
	if (self.LOADED_MODULES.indexOf(module_path) === -1) {
		const code = m_get(module_path);
		(null, eval)(code);
	}
}

self.onmessage = function(message) {
	self.onmessage = undefined;
	m_require(message.data);
}
