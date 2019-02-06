function m_supplies() {}
function m_require() {
	throw new Error('Cannot require from global scope');
}
