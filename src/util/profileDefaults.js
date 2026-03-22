function createProfile() {
  return {
    id: `profile-${Date.now()}`,
    name: 'Neues Profil',
    map: 'TheIsland_WP',
    sessionName: 'ASA Server',
    ports: { game: 7777, query: 27015, rcon: 27020 },
    adminPassword: '',
    serverPassword: '',
    clusterId: '',
    extraArgs: '',
    rawCommandLine: '',
    autoRestart: false
  };
}

module.exports = { createProfile };
