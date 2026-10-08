const { handleResetQueue } = require("../../server.js");

module.exports = async (req, res) => {
  return handleResetQueue(req, res);
};
