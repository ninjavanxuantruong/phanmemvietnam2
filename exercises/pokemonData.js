export const pokemonData = [
  // 🔥 Fire
  { id: 4, name: "Charmander", type: "fire", evolvesFrom: null, evolvesTo: 5, stage: 1 },
  { id: 5, name: "Charmeleon", type: "fire", evolvesFrom: 4, evolvesTo: 6, stage: 2 },
  { id: 6, name: "Charizard", type: "fire", evolvesFrom: 5, evolvesTo: null, stage: 3 },
  { id: 37, name: "Vulpix", type: "fire", evolvesFrom: null, evolvesTo: 38, stage: 1 },
  { id: 38, name: "Ninetales", type: "fire", evolvesFrom: 37, evolvesTo: null, stage: 2 },
  { id: 58, name: "Growlithe", type: "fire", evolvesFrom: null, evolvesTo: 59, stage: 1 },
  { id: 59, name: "Arcanine", type: "fire", evolvesFrom: 58, evolvesTo: null, stage: 2 },

  // 💧 Water
  { id: 7, name: "Squirtle", type: "water", evolvesFrom: null, evolvesTo: 8, stage: 1 },
  { id: 8, name: "Wartortle", type: "water", evolvesFrom: 7, evolvesTo: 9, stage: 2 },
  { id: 9, name: "Blastoise", type: "water", evolvesFrom: 8, evolvesTo: null, stage: 3 },
  { id: 54, name: "Psyduck", type: "water", evolvesFrom: null, evolvesTo: 55, stage: 1 },
  { id: 55, name: "Golduck", type: "water", evolvesFrom: 54, evolvesTo: null, stage: 2 },
  { id: 60, name: "Poliwag", type: "water", evolvesFrom: null, evolvesTo: 61, stage: 1 },
  { id: 61, name: "Poliwhirl", type: "water", evolvesFrom: 60, evolvesTo: 62, stage: 2 },
  { id: 62, name: "Poliwrath", type: "water", evolvesFrom: 61, evolvesTo: null, stage: 3 },

  // 🌿 Grass
  { id: 1, name: "Bulbasaur", type: "grass", evolvesFrom: null, evolvesTo: 2, stage: 1 },
  { id: 2, name: "Ivysaur", type: "grass", evolvesFrom: 1, evolvesTo: 3, stage: 2 },
  { id: 3, name: "Venusaur", type: "grass", evolvesFrom: 2, evolvesTo: null, stage: 3 },
  { id: 43, name: "Oddish", type: "grass", evolvesFrom: null, evolvesTo: 44, stage: 1 },
  { id: 44, name: "Gloom", type: "grass", evolvesFrom: 43, evolvesTo: 45, stage: 2 },
  { id: 45, name: "Vileplume", type: "grass", evolvesFrom: 44, evolvesTo: null, stage: 3 },
  { id: 69, name: "Bellsprout", type: "grass", evolvesFrom: null, evolvesTo: 70, stage: 1 },
  { id: 70, name: "Weepinbell", type: "grass", evolvesFrom: 69, evolvesTo: 71, stage: 2 },
  { id: 71, name: "Victreebel", type: "grass", evolvesFrom: 70, evolvesTo: null, stage: 3 },

  // ⚡ Electric
  { id: 25, name: "Pikachu", type: "electric", evolvesFrom: null, evolvesTo: 26, stage: 1 },
  { id: 26, name: "Raichu", type: "electric", evolvesFrom: 25, evolvesTo: null, stage: 2 },
  { id: 81, name: "Magnemite", type: "electric", evolvesFrom: null, evolvesTo: 82, stage: 1 },
  { id: 82, name: "Magneton", type: "electric", evolvesFrom: 81, evolvesTo: null, stage: 2 },
  { id: 100, name: "Voltorb", type: "electric", evolvesFrom: null, evolvesTo: 101, stage: 1 },
  { id: 101, name: "Electrode", type: "electric", evolvesFrom: 100, evolvesTo: null, stage: 2 },

  // 💫 Psychic
  { id: 63, name: "Abra", type: "psychic", evolvesFrom: null, evolvesTo: 64, stage: 1 },
  { id: 64, name: "Kadabra", type: "psychic", evolvesFrom: 63, evolvesTo: 65, stage: 2 },
  { id: 65, name: "Alakazam", type: "psychic", evolvesFrom: 64, evolvesTo: null, stage: 3 },
  { id: 96, name: "Drowzee", type: "psychic", evolvesFrom: null, evolvesTo: 97, stage: 1 },
  { id: 97, name: "Hypno", type: "psychic", evolvesFrom: 96, evolvesTo: null, stage: 2 },
  { id: 122, name: "Mr. Mime", type: "psychic", evolvesFrom: null, evolvesTo: null, stage: 2 },

  // 🪨 Rock
  { id: 74, name: "Geodude", type: "rock", evolvesFrom: null, evolvesTo: 75, stage: 1 },
  { id: 75, name: "Graveler", type: "rock", evolvesFrom: 74, evolvesTo: 76, stage: 2 },
  { id: 76, name: "Golem", type: "rock", evolvesFrom: 75, evolvesTo: null, stage: 3 },
  { id: 95, name: "Onix", type: "rock", evolvesFrom: null, evolvesTo: null, stage: 2 },
  { id: 111, name: "Rhyhorn", type: "rock", evolvesFrom: null, evolvesTo: 112, stage: 1 },
  { id: 112, name: "Rhydon", type: "rock", evolvesFrom: 111, evolvesTo: null, stage: 2 },

  // 🕊️ Flying
  { id: 16, name: "Pidgey", type: "flying", evolvesFrom: null, evolvesTo: 17, stage: 1 },
  { id: 17, name: "Pidgeotto", type: "flying", evolvesFrom: 16, evolvesTo: 18, stage: 2 },
  { id: 18, name: "Pidgeot", type: "flying", evolvesFrom: 17, evolvesTo: null, stage: 3 },
  { id: 21, name: "Spearow", type: "flying", evolvesFrom: null, evolvesTo: 22, stage: 1 },
  { id: 22, name: "Fearow", type: "flying", evolvesFrom: 21, evolvesTo: null, stage: 2 },
  { id: 84, name: "Doduo", type: "flying", evolvesFrom: null, evolvesTo: 85, stage: 1 },
  { id: 85, name: "Dodrio", type: "flying", evolvesFrom: 84, evolvesTo: null, stage: 2 },

  // 👻 Ghost
  { id: 92, name: "Gastly", type: "ghost", evolvesFrom: null, evolvesTo: 93, stage: 1 },
  { id: 93, name: "Haunter", type: "ghost", evolvesFrom: 92, evolvesTo: 94, stage: 2 },
  { id: 94, name: "Gengar", type: "ghost", evolvesFrom: 93, evolvesTo: null, stage: 3 },

  // ❄️ Ice
  { id: 86, name: "Seel", type: "ice", evolvesFrom: null, evolvesTo: 87, stage: 1 },
  { id: 87, name: "Dewgong", type: "ice", evolvesFrom: 86, evolvesTo: null, stage: 2 },
  { id: 90, name: "Shellder", type: "ice", evolvesFrom: null, evolvesTo: 91, stage: 1 },
  { id: 91, name: "Cloyster", type: "ice", evolvesFrom: 90, evolvesTo: null, stage: 2 },

  // ⚪ Normal
  { id: 52, name: "Meowth", type: "normal", evolvesFrom: null, evolvesTo: 53, stage: 1 },
  { id: 53, name: "Persian", type: "normal", evolvesFrom: 52, evolvesTo: null, stage: 2 },
  { id: 133, name: "Eevee", type: "normal", evolvesFrom: null, evolvesTo: 134, stage: 1 },
  { id: 134, name: "Vaporeon", type: "water", evolvesFrom: 133, evolvesTo: null, stage: 2 },
  { id: 143, name: "Snorlax", type: "normal", evolvesFrom: null, evolvesTo: null, stage: 2 }
];
