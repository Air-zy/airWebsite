const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function toggleInfo() {
  const infoContainer = document.querySelector('.info-button-container');
  infoContainer.classList.toggle('active');
}


// BOX
let velocityX = 0;
let velocityY = 0;
let newX = 0;
let newY = 0;
let mouseDown = false;

// BOIDS
const boids = [];
let mouseX = 0;
let mouseY = 0;

const atan2 = Math.atan2;
const min = Math.min;
const max = Math.max;

function clamp(value, minim, maxim) {
  return min(max(value, minim), maxim);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

canvas.addEventListener("mousemove", function (event) {
  mouseX = event.clientX - canvas.getBoundingClientRect().left;
  mouseY = event.clientY - canvas.getBoundingClientRect().top;
});

function breakApart(letterId) {
  var letter = document.getElementById(letterId);
  let letterRect = letter.getBoundingClientRect();
  let centerX = letterRect.left + letterRect.width / 2;
  let centerY = letterRect.top + letterRect.height / 2;

  for (let i = 0; i < 20; i++) {
    let offsetX = Math.random() * 40 - 20;
    let offsetY = Math.random() * 50 - 25;
    boids.push(
      new Boid(
        centerX + offsetX,
        centerY + offsetY,
        Math.random(),
        Math.random()
      )
    );
  }

  var positionX = Math.random() * 400 - 200; // random X position within -100px to 100px range
  var positionY = Math.random() * 400 - 200; // random Y position within -100px to 100px range
  var rotation = Math.random() * 360; // random rotation angle between 0 and 360 degrees

  letter.style.transform =
    "translate(" +
    positionX +
    "px, " +
    positionY +
    "px) rotate(" +
    rotation +
    "deg)";
  letter.style.transition = "transform " + 1 + "s, opacity 1s";
  letter.style.opacity = 0;
  setTimeout(function () {
    letter.remove();
  }, 1000);
}

const attractionStrength = 0.05;
const speedLimitSquared = 16; // square of speed limit(4)
const perceptionRadiusSquared = 2500;
const radiansToDegrees = (180/Math.PI)

class Boid {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = Math.random() * 2 - 1;
    this.vy = Math.random() * 2 - 1;
    this.life = 0;
  }

  update() {
    const alignment = this.alignment(boids);
    const cohesion = this.cohesion(boids);
    const separation = this.separation(boids);
    const mouseAttraction = this.mouseAttraction();

    // combine velocity adjustments
    const totalVX = this.vx + alignment.x + cohesion.x + separation.x + mouseAttraction.x;
    const totalVY = this.vy + alignment.y + cohesion.y + separation.y + mouseAttraction.y;
    const speedSquared = totalVX * totalVX + totalVY * totalVY;
    
    if (speedSquared > speedLimitSquared) {
      const scaleFactor = Math.sqrt(speedLimitSquared / speedSquared);
       this.vx = totalVX * scaleFactor;
      this.vy = totalVY * scaleFactor;
    } else {
      // update
      this.vx = totalVX;
      this.vy = totalVY;
    }
    
    if (this.x > newX && this.x < newX+100) { // box width
      if (this.y > newY && this.y < newY+100) { // box height

        velocityX += totalVX/10;
        velocityY += totalVY/10;
        
        const awayX = this.x < (newX + 50) ? -1 : 1;
        const awayY = this.y < (newY + 50) ? -1 : 1;

        // apply box physics
        const awayVelocityX = awayX * Math.abs(totalVX);
        const awayVelocityY = awayY * Math.abs(totalVY);
        
        this.vx += awayVelocityX*clamp(Math.abs(velocityX), 4, 100);
        this.vy += awayVelocityY*clamp(Math.abs(velocityY), 4, 100);
      }
    }

    // update position and wrap around edges
    this.x = (this.x + this.vx + canvas.width) % canvas.width;
    this.y = (this.y + this.vy + canvas.height) % canvas.height;
  }

  alignment(boids) {
    let avgVx = 0;
    let avgVy = 0;
    for (const boid of boids) {
      const dx = boid.x - this.x;
      const dy = boid.y - this.y;
      const distanceSquared = dx ** 2 + dy ** 2;
      if (boid !== this && distanceSquared < perceptionRadiusSquared) {
        avgVx += boid.vx;
        avgVy += boid.vy;
      }
    }
    const count = boids.length - 1;
    if (count > 0) {
      const invCount = 1 / count;
      avgVx *= invCount;
      avgVy *= invCount;
      const magSquared = avgVx ** 2 + avgVy ** 2;
      if (magSquared > 0) {
        const mag = Math.sqrt(magSquared);
        return { x: (avgVx / mag) * 0.05, y: (avgVy / mag) * 0.05 };
      }
    }
    return { x: 0, y: 0 };
  }

  cohesion(boids) {
    let avgX = 0;
    let avgY = 0;
    let count = 0;

    for (const boid of boids) {
      const dx = boid.x - this.x;
      const dy = boid.y - this.y;
      const distanceSquared = dx * dx + dy * dy;

      if (boid !== this && distanceSquared < perceptionRadiusSquared) {
        avgX += boid.x;
        avgY += boid.y;
        count++;
      }
    }

    if (count > 0) {
      avgX /= count;
      avgY /= count;
      return { x: (avgX - this.x) * 0.001, y: (avgY - this.y) * 0.001 };
    } else {
      return { x: 0, y: 0 };
    }
  }

  separation(boids) {
    let avgX = 0;
    let avgY = 0;
    let count = 0;

    for (const boid of boids) {
      const dx = this.x - boid.x;
      const dy = this.y - boid.y;
      const distanceSquared = dx * dx + dy * dy;

      if (boid !== this && distanceSquared < perceptionRadiusSquared) {
        avgX += dx;
        avgY += dy;
        count++;
      }
    }

    if (count > 0) {
      avgX /= count;
      avgY /= count;
      const mag = Math.sqrt(avgX ** 2 + avgY ** 2);
      return { x: (avgX / mag) * 0.05, y: (avgY / mag) * 0.05 };
    } else {
      return { x: 0, y: 0 };
    }
  }

  mouseAttraction() {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    return {
      x: normalizedDx * attractionStrength,
      y: normalizedDy * attractionStrength,
    };
  }

  draw() {
    this.life++;
    const angle = atan2(this.vy, this.vx);
    const hue = radiansToDegrees  * angle


    // saturation and lightness to constant values
    const lifeDividedBy2 = this.life / 2;
    const saturation = clamp(lifeDividedBy2, 0, 100);
    const lightness = 100 - clamp(lifeDividedBy2, 0, 50);

    // HSL to RGB
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.beginPath();
    // arrow shape
    ctx.moveTo(5, 0);
    ctx.lineTo(-5, -2.5);
    ctx.lineTo(-5, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // glow effect
    ctx.shadowColor = `hsl(${hue}, ${100}%, ${lightness}%)`;
    ctx.shadowBlur = 30;
  }
}

// main render
let then = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  let elapsed = now - then;

  // if elapsed time is less than the target frame interval
  if (elapsed < targetFrameInterval) {
    return;
  }

  // catch up with the missed frames
  let updates = 0;
  while (elapsed >= targetFrameInterval && updates < maxUpdatesPerFrame) {
    update();
    elapsed -= targetFrameInterval;
    updates++;
  }
  render();
  then = now - (elapsed % targetFrameInterval);
}

function update() {
  for (const boid of boids) {
    boid.update();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const boid of boids) {
    boid.draw();
  }
}

const targetFPS = 120;
const targetFrameInterval = 1000 / targetFPS;
const maxUpdatesPerFrame = 64;

// START
animate();

window.addEventListener("resize", function () {
  resizeCanvas();
});

document.addEventListener("DOMContentLoaded", function () {
  resizeCanvas();

  document.getElementById('youtube-link').setAttribute('href', 'https://www.youtube.com/channel/UCgyAZGAZR_knbCnp-bP9wkw');
  document.getElementById('twitter-link').setAttribute('href', 'https://x.com/airzyalt');
  document.getElementById('github-link').setAttribute('href', 'https://github.com/Air-zy');
  
  //BOX
  const box = document.getElementById('draggable-box');
  const text = document.getElementById('draggable-text');

  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let animationFrame;

  const gravity = 0.3;
  const friction = 0.99;
  const bounceFactor = 1;

  requestAnimationFrame(animate);
    box.addEventListener('mousedown', (e) => {
        mouseDown = true
        offsetX = e.clientX - box.getBoundingClientRect().left;
        offsetY = e.clientY - box.getBoundingClientRect().top;
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        box.style.cursor = 'grabbing';
        cancelAnimationFrame(animationFrame);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            velocityX = (mouseX - lastMouseX)*2;
            velocityY = (mouseY - lastMouseY)*2;

            box.style.left = `${mouseX - offsetX}px`;
            box.style.top = `${mouseY - offsetY}px`;

            const boxRect = box.getBoundingClientRect();
            newX = boxRect.left;
            newY = boxRect.top;
            text.style.left = `${newX + box.offsetWidth + 10}px`;
            text.style.top = `${newY}px`;
            text.innerText = velocityX + '\n' + velocityY;
          
            lastMouseX = mouseX;
            lastMouseY = mouseY;
        }
    });

    document.addEventListener('mouseup', () => {
        mouseDown = false;
        isDragging = false;
        box.style.cursor = 'grab';
        requestAnimationFrame(animate);
    });

    function animate() {
        if (!isDragging) {
            velocityY += gravity; // gravity

            const boxRect = box.getBoundingClientRect();
            const containerRect = document.body.getBoundingClientRect();

            velocityX *= friction;
            velocityY *= friction;
          
            newX = boxRect.left + velocityX;
            newY = boxRect.top + velocityY;

            if (newX < containerRect.left) {
                newX = containerRect.left;
                velocityX *= -bounceFactor; // Bounce back with reduced speed
            } else if (newX + boxRect.width > containerRect.right) {
                newX = containerRect.right - boxRect.width;
                velocityX *= -bounceFactor; // Bounce back with reduced speed
            }

            let bottom = false;
            if (newY < containerRect.top) {
                newY = containerRect.top;
                velocityY *= -bounceFactor; // Bounce back with reduced speed
            } else if (newY + boxRect.height > containerRect.bottom) {
                newY = containerRect.bottom - boxRect.height;
                velocityY *= -bounceFactor; // Bounce back with reduced speed
              bottom = true;
            }

            box.style.left = `${newX}px`;
            box.style.top = `${newY}px`;
          
            text.style.left = `${newX + box.offsetWidth + 10}px`;
            text.style.top = `${newY}px`;
            text.innerText = velocityX + '\n' + velocityY;
          
            if (Math.abs(velocityX) > 0.2 || Math.abs(velocityY) > 0.2 || bottom == false) {
                animationFrame = requestAnimationFrame(animate);
            }
        }
    }
});
