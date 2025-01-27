#version 300 es
in vec2 position;
in vec2 velocity;
in vec2 target;

out vec2 vPosition;
out vec2 vVelocity;
out vec2 vTarget;

uniform sampler2D edgeTexture;
uniform float deltaTime;
uniform vec2 resolution;
uniform float particleSpeed;
uniform float searchRadius;
uniform float attractionStrength;
uniform float time;

float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec2 flowField(vec2 position, float time) {
    float scale = 4.0;
    vec2 scaledPos = position * scale;
    float angle = sin(scaledPos.x + time * 0.2) * cos(scaledPos.y + time * 0.15) * 3.14159;
    return vec2(cos(angle), sin(angle));
}

void main() {
    vec2 pos = position;
    vec2 vel = velocity;
    vec2 tgt = target;
    
    vec4 edge = texture(edgeTexture, pos);
    
    if (edge.r > 0.5) {
        vel *= 0.95;
        tgt = vec2(-1.0);
    } else {
        float closestDist = searchRadius;
        vec2 closestEdge = pos;
        bool foundEdge = false;
        
        for (float y = -5.0; y <= 5.0; y += 1.0) {
            for (float x = -5.0; x <= 5.0; x += 1.0) {
                vec2 offset = vec2(x, y) / resolution;
                vec2 samplePos = pos + offset;
                
                if (samplePos.x < 0.0 || samplePos.x > 1.0 || 
                    samplePos.y < 0.0 || samplePos.y > 1.0) continue;
                
                vec4 sampleEdge = texture(edgeTexture, samplePos);
                if (sampleEdge.r > 0.5) {
                    float dist = length(offset);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEdge = samplePos;
                        foundEdge = true;
                    }
                }
            }
        }
        
        // Calculate flow field velocity
        vec2 flow = flowField(pos, time) * particleSpeed*0.001 * 2.0;
        
        if (foundEdge) {
            // For particles near edges, blend between flow and edge attraction
            vec2 toEdge = normalize(closestEdge - pos);
            vec2 edgeForce = toEdge * particleSpeed*0.001;
            float edgeInfluence = clamp(attractionStrength * 0.1, 0.0, 1.0);
            vel = mix(flow, edgeForce, edgeInfluence);
            tgt = closestEdge;
        } else {
            // For particles not near edges, use full flow field movement
            vel = flow;
            tgt = vec2(-1.0);
        }
        
        // Add a small amount of the current velocity for momentum
        vel = mix(vel, velocity, 0.1);
    }
    
    pos += vel * deltaTime;
    
    if (pos.x < -0.1 || pos.x > 1.1 || pos.y < -0.1 || pos.y > 1.1) {
        if (abs(pos.x - 0.5) > abs(pos.y - 0.5)) {
            pos.x = pos.x < 0.0 ? 1.0 : 0.0;
            pos.y = rand(vec2(pos.y, time));
        } else {
            pos.x = rand(vec2(pos.x, time));
            pos.y = pos.y < 0.0 ? 1.0 : 0.0;
        }
        vel = vec2(0.0);
    }
    
    vPosition = pos;
    vVelocity = vel;
    vTarget = tgt;
}