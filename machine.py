import json
import numpy as np

# =============================
# Helper Functions
# =============================

def get_impedance(component, freq):
    """
    Returns the complex impedance (Z) of a component at a given frequency (Hz).
    Handles DC and AC cases automatically.
    """
    t = component["type"]
    val = float(component["value"])
    w = 2 * np.pi * freq

    if t == "resistor":
        return val  # Ohms
    elif t == "inductor":
        # L in milliHenry -> jωL
        return 1j * w * val*1e-3 if freq > 0 else 1e-9  # short at DC (~0 ohm)
    elif t == "capacitor":
        # C in microfarad -> convert to farad
        C = val * 1e-6
        return 1 / (1j * w * C) if freq > 0 else 1e15  # open at DC (~∞ ohm)
    else:
        return None

def stamp_passive(G, n1, n2, Z):
    """
    Add passive element contribution to the conductance matrix G.
    Uses admittance Y = 1/Z.
    """
    Y = 1 / Z
    if n1 != 0:
        G[n1 - 1, n1 - 1] += Y
    if n2 != 0:
        G[n2 - 1, n2 - 1] += Y
    if n1 != 0 and n2 != 0:
        G[n1 - 1, n2 - 1] -= Y
        G[n2 - 1, n1 - 1] -= Y

# =============================
# Main MNA Solver
# =============================

def solve_circuit(filename):
    # Load JSON data
    with open(filename) as f:
        data = json.load(f)
    comps = data["components"]

    # Identify all unique node numbers
    nodes = {c["node1"] for c in comps} | {c["node2"] for c in comps}
    n = max(nodes)  # assume node 0 is ground
    
    # Find if there’s an AC source to set frequency
    freq = 0
    for c in comps:
        if "source_definition" in c and c["source_definition"]["type"] == "ac":
            freq = c["source_definition"]["frequency"]
            break

    # Initialize G matrix (n x n) and I vector (n x 1)
    G = np.zeros((n, n), dtype=complex)
    I = np.zeros((n, 1), dtype=complex)
    voltage_sources = []

    # --- STEP 1: Build MNA matrix for passive elements + current sources ---
    for comp in comps:
        t = comp["type"]
        n1, n2 = comp["node1"], comp["node2"]

        if t in ["resistor", "inductor", "capacitor"]:
            Z = get_impedance(comp, freq)
            stamp_passive(G, n1, n2, Z)

        elif t == "current-source":
            val = float(comp["value"])
            # Determine AC/DC
            if "source_definition" in comp:
                sdef = comp["source_definition"]
                if sdef["type"] == "ac":
                    phase = np.deg2rad(sdef.get("phase_angle", 0))
                    val = val * np.exp(1j * phase)
                # if dc: value stays real

            # Current source: inject +I into node2, -I into node1
            if n1 != 0:
                I[n1 - 1] -= val
            if n2 != 0:
                I[n2 - 1] += val

        elif t == "voltage-source":
            voltage_sources.append(comp)

    # --- STEP 2: Extend MNA for voltage sources ---
    m = len(voltage_sources)
    A = np.zeros((n + m, n + m), dtype=complex)
    z = np.zeros((n + m, 1), dtype=complex)

    # Copy G and I into A and z
    A[:n, :n] = G
    z[:n] = I

    # Add voltage source constraints
    for idx, vs in enumerate(voltage_sources):
        n1, n2 = vs["node1"], vs["node2"]
        val = float(vs["value"])
        if "source_definition" in vs:
            sdef = vs["source_definition"]
            if sdef["type"] == "ac":
                phase = np.deg2rad(sdef.get("phase_angle", 0))
                val = val * np.exp(1j * phase)

        # KVL equations
        if n1 != 0:
            A[n + idx, n1 - 1] = 1
            A[n1 - 1, n + idx] = 1
        if n2 != 0:
            A[n + idx, n2 - 1] = -1
            A[n2 - 1, n + idx] = -1

        # RHS for voltage source
        z[n + idx] = val

    # --- STEP 3: Solve the system ---
    x = np.linalg.solve(A, z)
    V_nodes = x[:n]
    I_vs = x[n:]

    # --- STEP 4: Display results ---
    print("\n================ CIRCUIT ANALYSIS RESULT ================\n")
    print(f"Operating frequency: {freq} Hz ({'AC' if freq > 0 else 'DC'})\n")

    for i, V in enumerate(V_nodes, start=1):
        val = V.item() if isinstance(V, np.ndarray) else V
        if np.iscomplex(val):
            print(f"Node {i:2d} Voltage: {val.real:.4f} + j{val.imag:.4f} V")
        else:
            print(f"Node {i:2d} Voltage: {val:.4f} V")

    print()
    for i, I_val in enumerate(I_vs, start=1):
        val = I_val.item() if isinstance(I_val, np.ndarray) else I_val
        if np.iscomplex(val):
            print(f"Voltage Source {i} Current: {val.real:.4f} + j{val.imag:.4f} A")
        else:
            print(f"Voltage Source {i} Current: {val:.4f} A")

    print("\n=========================================================\n")

# =============================
# Run on your file
# =============================
if __name__ == "__main__":
    solve_circuit("circuit (2).json")
