export function showCatchEffect(container = document.body) {
  const maxID = 649;
  const randomID = Math.floor(Math.random() * maxID) + 1;

  const pokeball = document.createElement('img');
  pokeball.src = 'https://cdn-icons-png.flaticon.com/512/361/361998.png';
  pokeball.alt = 'PokéBall';
  pokeball.style.position = 'fixed';
  pokeball.style.top = '50%';
  pokeball.style.left = '50%';
  pokeball.style.transform = 'translate(-50%, -50%)';
  pokeball.style.height = '120px';
  pokeball.style.zIndex = '1000';
  pokeball.style.animation = 'shake 0.5s ease-in-out 2';
  container.appendChild(pokeball);

  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes shake {
      0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
      25% { transform: translate(-50%, -50%) rotate(10deg); }
      50% { transform: translate(-50%, -50%) rotate(-10deg); }
      75% { transform: translate(-50%, -50%) rotate(10deg); }
    }

    @keyframes beamFlash {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); }
    }

    @keyframes summon {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
    }

    @keyframes chase {
      0%   { top: 40%; left: 30%; }
      25%  { top: 35%; left: 50%; }
      50%  { top: 45%; left: 40%; }
      75%  { top: 38%; left: 60%; }
      100% { top: 40%; left: 30%; }
    }

    @keyframes dodge {
      0%   { top: 60%; left: 70%; }
      25%  { top: 65%; left: 50%; }
      50%  { top: 55%; left: 60%; }
      75%  { top: 62%; left: 40%; }
      100% { top: 60%; left: 70%; }
    }

    @keyframes zap {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-150%, -50%) scale(2); opacity: 1; }
      100% { transform: translate(-300%, -50%) scale(3); opacity: 0; }
    }

    @keyframes attackPose {
      0% { transform: translate(-50%, -50%) scale(1.4); }
      50% { transform: translate(-50%, -52%) scale(1.6); }
      100% { transform: translate(-50%, -50%) scale(1.4); }
    }

    @keyframes faint {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
      50% { opacity: 0.5; transform: translate(-50%, -50%) rotate(20deg) scale(1.2); }
      100% { opacity: 0; transform: translate(-50%, -50%) rotate(90deg) scale(0.8); }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    pokeball.remove();

    const beam = document.createElement('div');
    beam.style.position = 'fixed';
    beam.style.top = '50%';
    beam.style.left = '50%';
    beam.style.transform = 'translate(-50%, -50%)';
    beam.style.width = '200px';
    beam.style.height = '200px';
    beam.style.background = 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)';
    beam.style.borderRadius = '50%';
    beam.style.animation = 'beamFlash 1s ease-out forwards';
    beam.style.zIndex = '999';
    container.appendChild(beam);

    setTimeout(() => {
      beam.remove();

      const wildPokemon = document.createElement('img');
      wildPokemon.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${randomID}.png`;
      wildPokemon.alt = 'Pokémon hoang dã';
      wildPokemon.style.position = 'fixed';
      wildPokemon.style.top = '40%';
      wildPokemon.style.left = '30%';
      wildPokemon.style.transform = 'translate(-50%, -50%) scale(1.4)';
      wildPokemon.style.boxShadow = '0 0 30px rgba(255,255,255,0.9)';
      wildPokemon.style.height = '180px';
      wildPokemon.style.zIndex = '1000';
      wildPokemon.style.animation = 'chase 2.4s ease-in-out';
      container.appendChild(wildPokemon);

      const pikachu = document.createElement('img');
      pikachu.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
      pikachu.alt = 'Pikachu';
      pikachu.style.position = 'fixed';
      pikachu.style.top = '60%';
      pikachu.style.left = '70%';
      pikachu.style.transform = 'translate(-50%, -50%) scale(1.4)';
      pikachu.style.boxShadow = '0 0 30px rgba(255,255,0,0.9)';
      pikachu.style.height = '180px';
      pikachu.style.zIndex = '1000';
      pikachu.style.animation = 'dodge 2.4s ease-in-out';
      container.appendChild(pikachu);
      fetch(`https://pokeapi.co/api/v2/pokemon/${randomID}`)
        .then(res => res.json())
        .then(data => {
          const name = capitalize(data.name);
          const display = document.createElement('div');
          display.textContent = `⚔️ Pikachu chuẩn bị chiến đấu với ${capitalize(name)}!`;
          display.style.position = 'fixed';
          display.style.top = '75%';
          display.style.left = '50%';
          display.style.transform = 'translateX(-50%)';
          display.style.fontSize = '24px';
          display.style.color = '#ffeb3b';
          display.style.textShadow = '2px 2px 6px black';
          display.style.zIndex = '1001';
          container.appendChild(display);

          // Sau khi di chuyển xong → Pikachu tung chiêu
          setTimeout(() => {
            pikachu.style.animation = 'attackPose 0.6s ease-in-out';

            const attack = document.createElement('div');
            attack.style.position = 'fixed';
            attack.style.top = '60%';
            attack.style.left = '70%';
            attack.style.transform = 'translate(-50%, -50%)';
            attack.style.width = '120px';
            attack.style.height = '120px';
            attack.style.borderRadius = '50%';
            attack.style.background = 'radial-gradient(circle, yellow 40%, orange 80%, transparent 100%)';
            attack.style.boxShadow = '0 0 120px yellow, 0 0 160px orange';
            attack.style.zIndex = '1002';
            attack.style.animation = 'zap 1.5s ease-out forwards';
            container.appendChild(attack);

            // Đối thủ ngất gục
            setTimeout(() => {
              wildPokemon.style.animation = 'faint 1s ease-in-out forwards';
            }, 1000);

            // Hiện kết quả
            setTimeout(() => {
              const result = document.createElement('div');
              result.textContent = '🎉 Pikachu đã chiến thắng!';
              result.style.position = 'fixed';
              result.style.top = '85%';
              result.style.left = '50%';
              result.style.transform = 'translateX(-50%)';
              result.style.fontSize = '22px';
              result.style.color = '#00ff00';
              result.style.textShadow = '2px 2px 6px black';
              result.style.zIndex = '1003';
              container.appendChild(result);
            }, 2000);
          }, 2400); // sau chase
        });
      }, 1000); // sau beam
      }, 1100); // sau PokéBall
      }

      function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
      }
