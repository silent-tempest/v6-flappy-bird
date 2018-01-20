/**
 * MIT License
 *
 * Copyright (c) 2017-2018 SILENT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
;( function ( window, undefined ) {

'use strict';

var use_cache = true;

if ( use_cache && 'serviceWorker' in navigator ) {
  navigator.serviceWorker.register( 'service-worker.js' )
    .then( function ( registration ) {
      console.log( 'Registration succeeded. Scope is ' + registration.scope );
    }, function ( ex ) {
      console.log( 'Registration failed with ' + ex );
    } );
}

var ignore = function ( event ) {
  return touchable &&
    !event.type.indexOf( 'mouse' ) &&
    ( event.target === null || !/^(?:input|textarea)$/i.test( event.target.tagName ) );
};

var safari = platform.os.family &&
  !platform.os.family === 'iOS' &&
  platform.name === 'Safari';

var touchable = 'ontouchend' in window,
    mode = touchable && !safari ? 'webgl' : '2d',
    scale = 0.8;

var options = {
  settings: {
    scale: scale
  },

  mode: mode
};

var renderer = v6( options )
  .noFill()
  .lineWidth( 2 * scale );

var theme = {
  pipe: v6.hsla( 0, 70, 60 )
};

var Bird = function () {};

Bird.prototype = {
  render: function ( renderer ) {
    renderer
      .stroke( this.color )
      .polygon( this.x, this.y, this.r, this.sides, this.angle );

    return this;
  },

  update: function ( dt ) {
    this.speed = max( this.topspeed * dt, ( this.speed - gravity * dt ) );

    var expangle = v6.Vector2D.angle( worldspeed * dt, this.speed );

    if ( this.angle > expangle ) {
      this.angle -= ( this.angle - expangle ) * 0.1;
    } else if ( this.angle < expangle ) {
      this.angle += ( expangle - this.angle ) * 0.1;
    }

    return this;
  },

  jump: function ( dt ) {
    this.speed = max( this.topspeed * dt, this.speed - this.lift * dt );
    return this;
  },

  restore: function () {
    this.y = this.speed = 0;
    return this;
  },

  constructor: Bird,
  color: v6.hsla( 0, 70, 60 ),
  topspeed: -1200 * scale,
  speed: 0,
  angle: 0,
  sides: 4,
  lift: 1750 * scale,
  x: 0,
  y: 0,
  r: 24 * scale
};

var bird = new Bird();

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
  render: function ( renderer ) {
    var x = this.x,
        w = this.w;

    if ( x > width / camerascale || x + w < -camx / camerascale ) {
      return this;
    }

    var d = lastcamy - expectedcamy,
        pad = 1 * scale,
        y1 = bird.y - camy / camerascale - d + pad,
        h1 = this.top - bird.y + camy / camerascale + d - pad,
        y2 = this.bottom,
        h2 = height / camerascale - y2 + bird.y - camy / camerascale - d - pad;

    if ( h1 > 0 ) {
      renderer.rect( x, y1, w, h1 );
    }

    if ( h2 > 0 ) {
      renderer.rect( x, y2, w, h2 );
    }

    return this;
  },

  constructor: Pipe,
  finished: false,
  w: 96 * scale
};

var get_highscore = function () {
  return +window.localStorage.getItem( 'highscore' );
};

var set_highscore = function ( value ) {
  return window.localStorage.setItem( 'highscore', value ), value;
};

var min = Math.min,
    max = Math.max,
    gravity = -55 * scale,
    score = 0,
    highscore = get_highscore(),
    width = 0,
    height = 0,
    vw = 0,
    vh = 0,
    worldspeed = 500 * scale,
    pipespeed = 0,
    pipeoffset = 200 * scale,
    minpipeheight = 256 * scale,
    maxpipeheight = 384 * scale,
    collisionsteps = Math.ceil( 1 * scale ),
    touched = false,
    jumped = false,
    stopped = true,
    started = false,
    collision = true,
    scaleup = true,
    speedup = false,
    pipes = [],
    camerascale = 1,
    mincamscale = touchable ? 0.75 : 1, // 1
    maxcamscale = touchable ? 1.125 : 1.5, // 1.5
    camx, camy, expectedcamy, lastcamy;

var ui = {};

ui[ '#restart-button' ] = ( function () {
  var touchstart = function ( event ) {
    if ( ignore( event ) ) {
      return;
    }

    if ( touchable ) {
      event = event.targetTouches[ 0 ];
      this.touched = true;
      this.touchpos.set( event.clientX, event.clientY );
    }

    $button.addClass( 'active' );
  };

  var touchend = function ( event, force ) {
    if ( !force && ignore( event ) ) {
      return;
    }

    if ( touchable ) {
      if ( stopped && this.touched ) {
        restart();
      }

      this.touched = false;
    } else if ( stopped ) {
      restart();
    }

    $button.removeClass( 'active' );
  };

  var $button = _( '#restart-button' );

  if ( touchable ) {
    var touchmove = function ( event ) {
      event = event.targetTouches[ 0 ];

      // fix FF `touchmove = alert;`
      if ( event.clientX !== this.touchpos[ 0 ] || event.clientY !== this.touchpos[ 1 ] ) {
        this.touched = false;
        touchend.call( this, event, true );
      }
    };

    $button
      .on( 'touchstart mousedown', touchstart )
      .on( 'touchmove', touchmove )
      .on( 'touchend mouseup', touchend );
  } else {
    $button
      .text( 'press any key to continue' )
      .on( 'mousedown', touchstart )
      .on( 'mouseup', touchend );
  }

  $button[ 0 ].touchpos = v6.vec2();

  return $button;
} )();

_.forEach( [
  '#tip', '#score', '#results', '#results-score', '#results-highscore', '.theme'
], function ( selector ) {
  this[ selector ] = _( selector );
}, ui );

if ( !touchable ) {
  ui[ '#tip' ].text( 'press spacebar to jump' );
}

ui[ '#results-highscore' ].text( highscore );

var resize = function () {
  width = ( vw = $window.width() ) * scale;
  height = ( vh = $window.height() ) * scale;
  camx = width * 0.2;
  camy = lastcamy = height * 0.5;
  renderer.resize( vw, vh );
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

var render_score = function ( score ) {
  ui[ stopped ? '#results-score' : '#score' ].text( score );
};

var jump = function ( event ) {
  if ( event && ignore( event ) ) {
    return;
  }

  if ( !stopped && ( !event || _.event.which( event ) === 1 ) ) {
    touched = true;

    if ( !started ) {
      start();
    }
  }
};

var stop = function () {
  bird.speed = 0;
  stopped = true;
  started = speedup = false;
  ui[ '#restart-button' ].show();
  ui[ '#results' ].show();
  ui[ '#score' ].hide();
  render_score( score );
};

var restart = function () {
  bird.restore();
  lastcamy = expectedcamy = -bird.y + camy / camerascale;
  stopped = false;
  scaleup = true;
  render_score( pipes.length = score = pipespeed = 0 );
  ui[ '#restart-button' ].hide();
  ui[ '#tip' ].show();
  bird.sides = _.random( 3, 5 );

  var a = _.random( 240, 270 ),
      b = a + 150,
      c = a + 210;

  ui[ '.theme' ].attr( 'content', renderer.canvas.style.background = v6.hsla( a, 35, 30, 1 ) );
  theme.pipe = v6.hsla( c, 90, 80 );
  bird.color = v6.hsla( b, 100, 70 );
};

var start = function () {
  ui[ '#results' ].hide();
  ui[ '#tip' ].hide();
  ui[ '#score' ].show();
  started = speedup = true;
};

var $window = _( window )
  .keydown( function ( event ) {
    if ( stopped ) {
      restart();
    } else if ( _.event.which( event ) === 32 ) {
      jump();
    }
  } )
  .on( touchable ? 'touchstart mousedown' : 'mousedown', jump )
  .on( touchable ? 'touchend mouseup keyup' : 'mouseup keyup', function () {
    touched = jumped = false;
  } )
  .resize( resize );

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
    pipespeed = _.clamp( pipespeed - worldspeed * 0.01, 0, worldspeed );
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
          pipe.top = min( pipe.top + 480 * delta * scale, pipe.bottom );
          pipe.bottom = max( pipe.bottom - 480 * delta * scale, pipe.top );
        }
      } else if ( !pipe.finished && pipe.x + pipe.w < bird.x - bird.r ) {
        pipe.finished = true;
        render_score( ++score );
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
    lastcamy -= ( lastcamy - expectedcamy ) * 0.1;
  } else if ( lastcamy < expectedcamy ) {
    lastcamy += ( expectedcamy - lastcamy ) * 0.1;
  }

  if ( score > highscore && collision ) {
    ui[ '#results-highscore' ].text( set_highscore( highscore = score ) );
  }
}, function () {
  renderer
    .restore()
    .clear()
    .save()
    .scale( camerascale, camerascale )
    .translate( camx / camerascale, lastcamy );

  bird.render( renderer );
  renderer.stroke( theme.pipe );

  for ( var i = pipes.length - 1; i >= 0; --i ) {
    pipes[ i ].render( renderer );
  }
} ).tick();

} )( this );
