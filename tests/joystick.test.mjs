import test from 'node:test';import assert from 'node:assert/strict';
import {joystickVector} from '../dist/touch-controls.js';
test('neutral and small drift produce no movement',()=>{for(const [x,y]of[[0,0],[2,-1],[-1,2]]){const v=joystickVector(x,y,40);assert.equal(Math.hypot(v.x,v.y),0);}});
test('joystick preserves proportional speed and forward direction',()=>{const slow=joystickVector(0,-20,40),fast=joystickVector(0,-40,40);assert.equal(slow.x,0);assert.ok(slow.y>0&&slow.y<fast.y);assert.equal(fast.y,1);});
test('diagonals and out-of-bounds drags cannot increase maximum speed',()=>{for(const[x,y]of[[40,-40],[300,400],[-900,-900]]){const v=joystickVector(x,y,40);assert.ok(Math.abs(Math.hypot(v.x,v.y)-1)<1e-12);assert.ok(Math.hypot(v.knobX,v.knobY)<=40+1e-10);assert.equal(Math.sign(v.x),Math.sign(x));assert.equal(Math.sign(v.y),-Math.sign(y));}});
