// backgroundgame.js

// Danh sách 10 ảnh nền từ repo GitHub của bạn
const backgrounds = [
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(1).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(2).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(3).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(4).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(5).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(6).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(7).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(8).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(9).jpg',
  'https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/b%20(10).jpg',
];

// Chọn ngẫu nhiên một ảnh nền
const randomBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];

// Gán ảnh nền vào body
document.body.style.background = `url('${randomBackground}') center/cover no-repeat`;
