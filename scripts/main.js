;( function ( window, undefined ) {

'use strict';

var ignore = function ( event ) {
  return touchable &&
    !event.type.indexOf( 'mouse' ) &&
    ( event.target === null || !/^(?:input|textarea)$/i.test( event.target.tagName ) );
};

var touchable = 'ontouchend' in window,
    mode = touchable ? 'webgl' : '2d',
    scale = window.devicePixelRatio || 1,
    canvas = v6( { mode: mode, settings: { scale: scale } } )
      .noFill().lineWidth( 2 * scale );

var theme = {
  pipe: v6.hsla( 0, 70, 60 )
};

var bird = {
  x: 0,
  y: 0,
  r: 24 * scale,
  lift: 1750 * scale,
  topspeed: -1200 * scale,
  speed: 0,
  color: v6.hsla( 0, 70, 60 ),
  angle: 0,
  sides: 4,

  render: function ( canvas ) {
    canvas
      .stroke( this.color )
      .polygon( this.x, this.y, this.r, this.sides, this.angle );

    return this;
  },

  update: function ( dt ) {
    this.speed = max( this.topspeed * dt, ( this.speed - gravity * dt - air * dt ) );

    var expangle = v6.Vector2D.angle( worldspeed * dt, this.speed );

    if ( this.angle > expangle ) {
      this.angle -= ( this.angle - expangle ) * 0.1;
    } else if ( this.angle < expangle ) {
      this.angle += ( expangle - this.angle ) * 0.1;
    }

    return this;
  },

  jump: function ( dt ) {
    return this.speed = max( this.topspeed * dt, this.speed - this.lift * dt ), this;
  },

  restore: function () {
    this.y = 0;
    this.speed = 0;
  }
};

var smoothrandom = {
  last: 0,
  step: 300 * scale,

  get: function () {
    return this.last += _.random( -this.step, this.step );
  }
};

var Pipe = function ( x ) {
  var center, spacing;

  if ( x === undefined ) {
    spacing = maxpipeheight;
    center = smoothrandom.last = 0;
    this.x = pipeoffset * 2;
  } else {
    spacing = _.random( minpipeheight, maxpipeheight );
    center = smoothrandom.get();
    this.x = x;
  }

  this.top = center - spacing / 2;
  this.bottom = this.top + spacing;
};

Pipe.prototype = {
  constructor: Pipe,
  finished: false,
  w: 96 * scale,

  render: function ( canvas ) {
    var x = this.x,
        w = this.w;

    if ( x > width / camerascale || x + w < -camx / camerascale ) {
      return this;
    }

    var d = lastcamy - expectedcamy,
        y1 = bird.y - camy / camerascale - d + 10 * scale,
        h1 = this.top - bird.y + camy / camerascale + d - 10 * scale,
        y2 = this.bottom,
        h2 = height / camerascale - y2 + bird.y - camy / camerascale - d - 10 * scale;

    if ( h1 > 0 ) {
      canvas.rect( x, y1, w, h1 );
    }

    if ( h2 > 0 ) {
      canvas.rect( x, y2, w, h2 );
    }

    return this;
  }
};

var gethighscore = function () {
  return +window.localStorage.getItem( 'highscore' );
};

var sethighscore = function ( value ) {
  return window.localStorage.setItem( 'highscore', value ), value;
};

var min = Math.min,
    max = Math.max,
    gravity = -55 * scale,
    air = 1,
    score = 0,
    highscore = gethighscore(),
    width = 0,
    height = 0,
    vw = 0,
    vh = 0,
    worldspeed = 500 * scale,
    pipespeed = 0,
    pipeoffset = 200 * scale,
    minpipeheight = 256 * scale,
    maxpipeheight = 384 * scale,
    collisionsteps = Math.floor( 1 * scale ),
    touched = false,
    jumped = false,
    stopped = true,
    started = false,
    collision = true,
    scaleup = true,
    speedup = false,
    pipes = [],
    scoreelement = window.document.getElementById( 'score' ),
    tipelement = window.document.getElementById( 'tip' ),
    resultselement = document.getElementById( 'results' ),
    rscoreelement = document.getElementById( 'results-score' ),
    rhighscoreelement = document.getElementById( 'results-highscore' ),
    camerascale = 1,
    mincamscale = 1,
    maxcamscale = 1.5,
    camx, camy, expectedcamy, lastcamy;

var resize = function () {
  vw = $window.width();
  vh = $window.height();
  resizecanvas();
};

var resizecanvas = function () {
  width = vw * scale;
  height = vh * scale;
  camx = width * 0.2;
  camy = lastcamy = height * 0.5;
  canvas.resize( vw, vh );
};

var collide = function ( bird, pipe ) {
  if ( bird.x + bird.r < pipe.x ||
    bird.x - bird.r > pipe.x + pipe.w ||
    bird.y - bird.r > pipe.top && bird.y + bird.r < pipe.bottom ) {

    return false;
  } else if ( bird.x + bird.r >= pipe.x &&
    bird.x - bird.r <= pipe.x + pipe.w &&
    ( bird.y + bird.r < pipe.top || bird.y - bird.r > pipe.bottom ) ) {

    return true;
  }

  return intersect( bird.x, bird.y, bird.r, pipe.x, pipe.top - bird.r * 2, pipe.w, bird.r * 2 ) ||
    intersect( bird.x, bird.y, bird.r, pipe.x, pipe.bottom, pipe.w, bird.r * 2 );
};

var dist = function ( x1, y1, x2, y2, w2, h2 ) {
  var dx = x1 - max( x2, min( x1, x2 + w2 ) ),
      dy = y1 - max( y2, min( y1, y2 + h2 ) );

  return dx * dx + dy * dy;
};

var intersect = function ( x1, y1, r1, x2, y2, w2, h2 ) {
  return dist( x1, y1, x2, y2, w2, h2 ) <= r1 * r1;
};

var addpipe = function ( x ) {
  return pipes.push( x = new Pipe( x ) ), x;
};

var renderscore = function ( score ) {
  ( stopped ? rscoreelement : scoreelement ).textContent = score;
};

var jump = function ( event ) {
  if ( event && ignore( event ) ) {
    return;
  }

  if ( !stopped && ( !event || peako.event.which( event ) === 1 ) ) {
    touched = true;

    if ( !started ) {
      start();
    }
  }
};

var stop = function () {
  if ( score > highscore && collision ) {
    sethighscore( rhighscoreelement.textContent = highscore = score );
  }

  bird.speed = 0;
  stopped = true;
  started = speedup = false;
  scoreelement.style.display = 'none';
  rscoreelement.textContent = score;
  restartbutton.style.display = resultselement.style.display = '';
};

var $theme = peako( '.theme' );

var restart = function () {
  bird.restore();
  lastcamy = expectedcamy = -bird.y + camy / camerascale;
  stopped = false;
  scaleup = true;
  renderscore( pipes.length = score = pipespeed = 0 );
  restartbutton.style.display = 'none';
  tipelement.style.display = '';
  bird.sides = peako.random( 3, 6 );

  var a = peako.random( 240, 270 ),
      b = a + 150,
      c = a + 210;

  $theme.attr( 'content', canvas.canvas.style.background = v6.hsla( a, 35, 30, 1 ) );
  theme.pipe = v6.hsla( c, 90, 80 );
  bird.color = v6.hsla( b, 100, 70 );
};

var start = function () {
  scoreelement.style.display = '';
  tipelement.style.display = resultselement.style.display = 'none';
  started = speedup = true;
};

var restartbutton = function () {
  var touchstart = function ( event ) {
    if ( !ignore( event ) ) {
      button.addClass( 'active' );

      if ( touchable ) {
        this.touched = true;
        event = event.targetTouches[ 0 ];
        ( this.touchpos || ( this.touchpos = v6.vec2() ) ).set( event.clientX, event.clientY );
      }
    }
  };

  var touchend = function ( event, force ) {
    if ( force || !ignore( event ) ) {
      button.removeClass( 'active' );

      if ( touchable ) {
        if ( stopped && this.touched ) {
          restart();
        }

        this.touched = false;
      } else if ( stopped ) {
        restart();
      }
    }
  };

  var button = _( '#restart-button' )
    .on( touchable ? 'touchstart mousedown' : 'mousedown', touchstart )
    .on( touchable ? 'touchend mouseup' : 'mouseup', touchend );

  if ( touchable ) {
    button.touchmove( function ( event ) {
      event = event.targetTouches[ 0 ];

      if ( event.clientX !== this.touchpos[ 0 ] || event.clientY !== this.touchpos[ 1 ] ) {
        this.touched = false;
        touchend.call( this, event, true );
      }
    } );
  }

  return button[ 0 ];
}();

var $window = _( window )
  .keydown( function ( event ) {
    if ( stopped ) {
      restart();
    } else if ( peako.event.which( event ) === 32 ) {
      jump( null );
    }
  } )
  .on( touchable ? 'touchstart mousedown' : 'mousedown', jump )
  .on( touchable ? 'touchend mouseup keyup' : 'mouseup keyup', function () {
    touched = jumped = false;
  } )
  .resize( resize );

rhighscoreelement.textContent = highscore;
resize();
restart();

v6.ticker( function ( delta ) {
  var lastindex = pipes.length - 1,
      last = pipes[ lastindex ],
      offset, steps, xstep, ystep, i, pipe;

  if ( stopped ) {
    camerascale = _.clamp( camerascale + 0.05 * camerascale, mincamscale, maxcamscale );
  }

  if ( speedup ) {
    pipespeed = _.clamp( pipespeed + worldspeed * 0.02, 0, worldspeed );
    speedup = pipespeed !== worldspeed;
  } else if ( stopped ) {
    pipespeed = peako.clamp( pipespeed - worldspeed * 0.01, 0, worldspeed );
  }

  if ( scaleup ) {
    camerascale = _.clamp( camerascale - 0.05, mincamscale, maxcamscale );
    scaleup = camerascale !== mincamscale;
  }

  if ( !stopped && ( touched && !jumped || !started && bird.y > 0 ) ) {
    jumped = started;
    bird.jump( delta );
  }

  bird.update( delta );
  steps = collisionsteps;
  xstep = pipespeed / steps * delta;
  ystep = bird.speed / steps;

  for ( ; steps > 0; --steps ) {
    bird.y += ystep;

    for ( i = lastindex; i >= 0; --i ) {
      pipe = pipes[ i ];
      pipe.x -= xstep;

      if ( pipe.finished ) {
        if ( pipe.top !== pipe.bottom ) {
          pipe.top = min( pipe.top + 120 * delta, pipe.bottom );
          pipe.bottom = max( pipe.bottom - 30 * delta, pipe.top );
        }
      } else if ( !pipe.finished && pipe.x + pipe.w < bird.x - bird.r ) {
        pipe.finished = true;
        renderscore( ++score );
      }

      if ( pipe.x + pipe.w < -camx / mincamscale ) {
        pipes.splice( i, 1 );
        --lastindex;
      } else if ( collision && collide( bird, pipe ) ) {
        for ( ; i <= lastindex; ++i ) {
          pipes[ i ].x += xstep;
        }

        if ( bird.y + bird.r > pipe.top && bird.y - bird.r < pipe.bottom ) {
          bird.y -= ystep;
        } else {
          pipespeed = 0;
        }

        steps = 0;
        stop();
        break;
      }
    }
  }

  while ( last ? ( offset = last.x + last.w + pipeoffset ) < width / mincamscale : !started ) {
    last = addpipe( offset );
  }

  expectedcamy = -bird.y + camy / camerascale;

  if ( lastcamy > expectedcamy ) {
    lastcamy -= ( lastcamy - expectedcamy ) * 0.1; // ( lastcamy - expectedcamy > 100 ? 0.25 : 0.1 );
  } else if ( lastcamy < expectedcamy ) {
    lastcamy += ( expectedcamy - lastcamy ) * 0.1; // ( expectedcamy - lastcamy > 100 ? 0.25 : 0.1 );;
  }
}, function () {
  canvas
    .restore()
    .clear()
    .save()
    .scale( camerascale, camerascale )
    .translate( camx / camerascale, lastcamy );

  bird.render( canvas );
  canvas.stroke( theme.pipe );

  for ( var i = pipes.length - 1; i >= 0; --i ) {
    pipes[ i ].render( canvas );
  }
} ).tick();

} )( this );
