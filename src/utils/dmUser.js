async function sendDM(user, contentOrEmbed) {
  try {
    await user.send(contentOrEmbed);
    return true;
  } catch (e) {
    return false; // DM closed
  }
}

module.exports = { sendDM };
