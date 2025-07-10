// pokeball-effect.js
export function showCatchEffect(container = document.body) {
  const maxID = 649; // Chỉ dùng sprite ổn định

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
  pokeball.style.animation = 'shake 1s ease-in-out 3';
  container.appendChild(pokeball);

  // Style animations
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes shake {
      0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
      25% { transform: translate(-50%, -50%) rotate(10deg); }
      50% { transform: translate(-50%, -50%) rotate(-10deg); }
      75% { transform: translate(-50%, -50%) rotate(10deg); }
    }

    @keyframes beamFlash {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.5);
      }
      50% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.2);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.6);
      }
    }


    @keyframes summon {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.5);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.4);
      }
    }



  `;
  document.head.appendChild(style);

  setTimeout(() => {
    pokeball.remove();

    // Beam effect
    const beam = document.createElement('div');
    beam.className = 'beam';
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

      // Pokémon sprite
      const pokemon = document.createElement('img');
      pokemon.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${randomID}.png`;
      pokemon.alt = 'Pokémon xuất hiện!';
      pokemon.style.position = 'fixed';
      pokemon.style.top = '50%';
      pokemon.style.left = '50%';
      pokemon.style.transform = 'translate(-50%, -50%) scale(1.4)';
      pokemon.style.boxShadow = '0 0 30px rgba(255,255,255,0.9)';
      pokemon.style.height = '240px';
      pokemon.style.zIndex = '1000';
      pokemon.style.animation = 'summon 0.8s ease-out forwards';
      container.appendChild(pokemon);

      // Lấy tên Pokémon từ PokeAPI
      fetch(`https://pokeapi.co/api/v2/pokemon/${randomID}`)
        .then(res => res.json())
        .then(data => {
          const name = capitalize(data.name);
          const display = document.createElement('div');
          display.textContent = `🎉 Bạn vừa bắt được ${name}`;
          display.style.position = 'fixed';
          display.style.top = '70%';
          display.style.left = '50%';
          display.style.transform = 'translateX(-50%)';
          display.style.fontSize = '24px';
          display.style.color = 'white';
          display.style.textShadow = '2px 2px 6px black';
          display.style.zIndex = '1001';
          container.appendChild(display);
        });
    }, 1000); // sau beam sáng
  }, 3100); // sau rung PokéBall
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
