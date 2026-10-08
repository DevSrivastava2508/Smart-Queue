const { handleMarkAbsent } = require("../../server.js");

module.exports = async (req, res) => {
  return handleMarkAbsent(req, res);
};
