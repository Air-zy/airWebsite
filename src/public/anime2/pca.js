// 1. Center the data
function centerData(data) {
    const n = data.length;
    const dim = data[0].length;
    const mean = Array(dim).fill(0);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < dim; j++) {
            mean[j] += data[i][j];
        }
    }
    for (let j = 0; j < dim; j++) {
        mean[j] /= n;
    }

    const centered = data.map(row => row.map((x, j) => x - mean[j]));
    return { centered, mean };
}

// 2. Compute covariance matrix
function covarianceMatrix(data) {
    const n = data.length;
    const dim = data[0].length;
    const cov = Array(dim).fill(0).map(() => Array(dim).fill(0));

    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += data[k][i] * data[k][j];
            }
            cov[i][j] = sum / (n - 1);
        }
    }
    return cov;
}

// 3. Power iteration to find top eigenvector
function powerIteration(A, iterations = 1000, tol = 1e-6) {
    const n = A.length;
    let b = Array(n).fill(0).map(() => Math.random());
    let norm = Math.sqrt(b.reduce((sum, x) => sum + x*x, 0));
    b = b.map(x => x / norm);

    let eigenvalue = 0;

    for (let it = 0; it < iterations; it++) {
        const bNext = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                bNext[i] += A[i][j] * b[j];
            }
        }
        norm = Math.sqrt(bNext.reduce((sum, x) => sum + x*x, 0));
        for (let i = 0; i < n; i++) bNext[i] /= norm;

        const diff = Math.max(...bNext.map((v, i) => Math.abs(v - b[i])));
        b = bNext;
        if (diff < tol) break;
    }

    // Rayleigh quotient for eigenvalue
    const Ab = Array(n).fill(0);
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
            Ab[i] += A[i][j] * b[j];

    eigenvalue = b.reduce((sum, x, i) => sum + x * Ab[i], 0);
    return { eigenvector: b, eigenvalue };
}

// 4. Deflate matrix to find second eigenvector
function deflateMatrix(A, eigenvector, eigenvalue) {
    const n = A.length;
    const B = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            B[i][j] = A[i][j] - eigenvalue * eigenvector[i] * eigenvector[j];
        }
    }
    return B;
}

export function pca3D(data) {
    const { centered } = centerData(data);
    const cov = covarianceMatrix(centered);

    // Top eigenvector
    const { eigenvector: v1, eigenvalue: l1 } = powerIteration(cov);
    // Deflate to find 2nd
    const cov2 = deflateMatrix(cov, v1, l1);
    const { eigenvector: v2, eigenvalue: l2 } = powerIteration(cov2);
    // Deflate to find 3rd
    const cov3 = deflateMatrix(cov2, v2, l2);
    const { eigenvector: v3 } = powerIteration(cov3);

    // Project data onto top 3 eigenvectors
    const projected = centered.map(row => [
        row.reduce((sum, x, i) => sum + x * v1[i], 0), // X
        row.reduce((sum, x, i) => sum + x * v2[i], 0), // Y
        row.reduce((sum, x, i) => sum + x * v3[i], 0)  // Z (for color)
    ]);

    return projected;
}
