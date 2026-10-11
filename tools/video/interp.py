# optical-flow frame interpolation (DIS flow, bidirectional warp with occlusion-aware blending)
import cv2, numpy as np


class Interp:
    def __init__(self, frames):
        self.f = frames  # list of BGR images (uint8 or float)
        self.dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        self.cache = {}
        h, w = frames[0].shape[:2]
        self.gx, self.gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
        self.gray = [cv2.cvtColor(f if f.dtype == np.uint8 else np.clip(f * 255, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY) for f in frames]
        self.scale = 1 / 255.0 if frames[0].dtype == np.uint8 else 1.0

    def flow(self, i, j):
        k = (i, j)
        if k not in self.cache:
            if len(self.cache) > 12:
                self.cache.pop(next(iter(self.cache)))
            self.cache[k] = self.dis.calc(self.gray[i], self.gray[j], None)
        return self.cache[k]

    def at(self, t):
        n = len(self.f)
        t = min(max(t, 0), n - 1)
        i = int(np.floor(t))
        a = t - i
        if a < 1e-3 or i >= n - 1:
            return self.f[min(i, n - 1)].astype(np.float32) * self.scale
        j = i + 1
        fij, fji = self.flow(i, j), self.flow(j, i)
        # pixel p at time t came from p + a*F(j->i) in frame i and p + (1-a)*F(i->j) in frame j
        Ii = cv2.remap(self.f[i].astype(np.float32) * self.scale, self.gx + a * fji[..., 0], self.gy + a * fji[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        Ij = cv2.remap(self.f[j].astype(np.float32) * self.scale, self.gx + (1 - a) * fij[..., 0], self.gy + (1 - a) * fij[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        # forward-backward disagreement marks occlusions; lean on the nearer frame there
        bw = cv2.remap(fji, self.gx + fij[..., 0], self.gy + fij[..., 1], cv2.INTER_LINEAR)
        occ = np.clip(np.linalg.norm(fij + bw, axis=2) / 2.0, 0, 1)[..., None]
        wi = (1 - a) * (1 + occ * (1 - 2 * a))
        wj = a * (1 - occ * (1 - 2 * a))
        return (Ii * wi + Ij * wj) / (wi + wj + 1e-6)
