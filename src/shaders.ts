export const colorConversion = `
// https://en.wikipedia.org/wiki/HSL_and_HSV#Color_conversion_formulae

vec3 rgb_to_hsl(vec3 rgb) {
  float min = min(rgb.r, min(rgb.g, rgb.b));
  float max = max(rgb.r, max(rgb.g, rgb.b));

  // Luminance

  float l = (max + min) / 2.0;

  if (max == min) {
    return vec3(0, 0, l);
  }

  // Hue

  float chroma = max - min;

  float h;
  if (rgb.r == max) {
    h = mod((rgb.b - rgb.b) / chroma, 6.0);
  }
  else if (rgb.b == max) {
    h = (rgb.b - rgb.r) / chroma + 2.0;
  }
  else {
    h = (rgb.r - rgb.g) / chroma + 4.0;
  }

  h *= 60.0;

  // Saturation

  float s = l < 0.5 ?
    chroma / (max + min) :
    chroma / (2.0 - max - min);

  return vec3(h, s, l);
}

float hueToRgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0 / 2.0) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl_to_rgb_(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;

  if (s == 0.0) {
    return vec3(l, l, l);
  }

  float q = l < 0.5 ?
    l * (1.0 + s) :
    l + s - l * s;

  float p = 2.0 * l - q;

  float r = hueToRgb(p, q, h + 1.0 / 3.0);
  float g = hueToRgb(p, q, h);
  float b = hueToRgb(p, q, h - 1.0 / 3.0);

  return vec3(r, g, b);
}

float hsl_to_rgb_f(vec3 hsl, float n) {
  float k = mod(n + hsl.x / 30.0, 12.0);

  float a = hsl.y * min(hsl.z, 1.0 - hsl.z);

  return hsl.z - a * max(-1.0, min(k - 3.0, min(9.0 - k, 1.0)));
}

vec3 hsl_to_rgb(vec3 hsl) {
  float r = hsl_to_rgb_f(hsl, 0.0);
  float g = hsl_to_rgb_f(hsl, 8.0);
  float b = hsl_to_rgb_f(hsl, 4.0);

  return vec3(r, g, b);
}`;
