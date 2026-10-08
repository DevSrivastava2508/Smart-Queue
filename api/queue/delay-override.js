const { handleDelayOverride } = require("../../server.js");

module.exports = async (req, res) => {
  return handleDelayOverride(req, res);
};
