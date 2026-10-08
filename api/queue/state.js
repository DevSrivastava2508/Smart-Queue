const { handleGetQueueState } = require("../../server.js");

module.exports = async (req, res) => {
  return handleGetQueueState(req, res);
};
