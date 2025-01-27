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
    vec2 flow = flowField(pos, time) * particleSpeed * 0.001 * 2.0;
    
    // Only very strong edges can hold particles
    if (edge.r > 0.4) {
        float edgeStrength = smoothstep(0.85, 1.0, edge.r);
        // Need much higher attraction to maintain stickiness
        float baseStickiness = smoothstep(15.0, 40.0, attractionStrength);
        
        // Even strong edges have reduced stickiness
        float stickiness = mix(baseStickiness * 1.0, 0.9, edgeStrength * edgeStrength);
        
        // Much more likely to become unstuck
        if (stickiness < 0.7 || edgeStrength < 0.9 || rand(pos + time * 0.008) > stickiness) {
            // Stronger flow influence when becoming unstuck
            vel = mix(flow * 1.2, vel * 0.9, stickiness);
            tgt = vec2(-1.0);
        } else {
            // Even stuck particles have significant movement
            float dampening = mix(0.6, 0.9, edgeStrength);
            vel *= mix(dampening, 0.85, stickiness);
            // Strong flow influence even when stuck
            vel += flow * (1.0 - stickiness * 0.7) * (1.0 - edgeStrength);
            tgt = pos;
        }
    } else {
        float closestDist = searchRadius;
        vec2 closestEdge = pos;
        bool foundEdge = false;
        
        // Reduced search radius
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            for (float x = -2.0; x <= 2.0; x += 1.0) {
                vec2 offset = vec2(x, y) / resolution;
                vec2 samplePos = pos + offset;
                
                if (samplePos.x < 0.0 || samplePos.x > 1.0 || 
                    samplePos.y < 0.0 || samplePos.y > 1.0) continue;
                
                vec4 sampleEdge = texture(edgeTexture, samplePos);
                if (sampleEdge.r > 0.85) {
                    float dist = length(offset);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEdge = samplePos;
                        foundEdge = true;
                    }
                }
            }
        }
        
        if (foundEdge) {
            // Much weaker edge attraction
            vec2 toEdge = normalize(closestEdge - pos);
            vec2 edgeForce = toEdge * particleSpeed * 0.0003;
            float edgeInfluence = smoothstep(10.0, 35.0, attractionStrength) * 0.4;
            vel = mix(flow * 1.2, edgeForce, edgeInfluence);
            tgt = closestEdge;
        } else {
            vel = flow;
            tgt = vec2(-1.0);
        }
        
        // Increased momentum
        vel = mix(vel, velocity, 0.3);
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