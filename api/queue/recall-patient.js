const { handleRecallPatient } = require("../../server.js");

module.exports = async (req, res) => {
  return handleRecallPatient(req, res);
};
