import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
#functions
def get_all_nodes(*dfs):
    nodes = set()
    for df in dfs:
        nodes.update(df['node1'])
        nodes.update(df['node2'])
    nodes.discard(0)  
    return sorted(nodes)

def stamp_resistor(G, n1_idx, n2_idx, R):
    Y = 1 / R
    if n1_idx is not None:
        G[n1_idx, n1_idx] += Y
    if n2_idx is not None:
        G[n2_idx, n2_idx] += Y
    if n1_idx is not None and n2_idx is not None:
        G[n1_idx, n2_idx] -= Y
        G[n2_idx, n1_idx] -= Y
        
def stamp_capacitor(C, n1_idx, n2_idx, C_value):
    C_value = C_value * 1e-6 #micro-farad
    if n1_idx is not None:
        C[n1_idx, n1_idx] += C_value
    if n2_idx is not None:
        C[n2_idx, n2_idx] += C_value
    if n1_idx is not None and n2_idx is not None:
        C[n1_idx, n2_idx] -= C_value
        C[n2_idx, n1_idx] -= C_value
        

def stamp_inductor(G, C, n1_idx, n2_idx, ind_idx, L_value,):
    L_value = L_value * 1e-3 #milli-henry
    if n1_idx is not None:
        G[n1_idx, ind_idx] += 1
        G[ind_idx, n1_idx] += 1
    if n2_idx is not None:
        G[n2_idx, ind_idx] -= 1
        G[ind_idx, n2_idx] -= 1
    C[ind_idx, ind_idx] = -L_value
    
def stamp_voltage_G(G, n1_idx, n2_idx, V_idx):
    if n1_idx is not None:
        G[n1_idx, V_idx] += 1
        G[V_idx, n1_idx] += 1
    if n2_idx is not None:
        G[n2_idx, V_idx] -= 1
        G[V_idx, n2_idx] -= 1
    
def stamp_voltage_ft(f_t, V_idx, V_value):
        f_t[V_idx] = V_value
    
def stamp_current(f_t, n1_idx, n2_idx, I_value):
    if n1_idx is not None:
        f_t[n1_idx] -= I_value
    if n2_idx is not None:
        f_t[n2_idx] += I_value
                    
def circuit_solver(filename):
    with open(filename, 'r') as f:
        netlist_data = json.load(f) 
    components_df = pd.DataFrame(netlist_data['components'])
    components_df['node1'] = components_df['node1'].astype(int)
    components_df['node2'] = components_df['node2'].astype(int)
    
    passive_comp = ['resistor', 'capacitor', 'inductor']
    source_comp = ['voltage-source', 'current-source']
    passive_comp_df = components_df[components_df['type'].isin(passive_comp)].copy()
    source_df = components_df[components_df['type'].isin(source_comp)].copy()
    passive_comp_df.reset_index(drop=True, inplace=True)
    source_df.reset_index(drop=True, inplace=True)
    
    # add source definitions to columns
    source_df['source_type'] = source_df['source_definition'].apply(
        lambda sd: sd.get('type') if isinstance(sd, dict) else None
    )
    source_df['phase_angle'] = source_df['source_definition'].apply(
        lambda sd: sd.get('phase_angle', 0) if isinstance(sd, dict) else 0
    )
    source_df['frequency'] = source_df['source_definition'].apply(
        lambda sd: sd.get('frequency') if isinstance(sd, dict) else None
    )
    source_df = source_df.drop(columns = ['source_definition'])
   
    # counting components and nodes
    node_list = get_all_nodes(passive_comp_df, source_df)
    n = len(node_list)
    n_resistor = (passive_comp_df['type'] == 'resistor').sum()
    n_capacitor = (passive_comp_df['type'] == 'capacitor').sum()
    n_inductor = (passive_comp_df['type'] == 'inductor').sum()
    num_V = (source_df['type'] == 'voltage-source').sum()
    num_I = (source_df['type'] == 'current-source').sum()
    m = num_V + n_inductor 
     
    #index mapping
    node_map = {node: idx for idx, node in enumerate(node_list)} #node voltages
    vsources = source_df[source_df["type"] == "voltage-source"]
    vs_map = {int(idx): int(len(node_list) + i) for i, idx in enumerate(vsources.index)} #voltage source current
    inductors = passive_comp_df[passive_comp_df["type"] == "inductor"]
    ind_map = {int(idx): int(len(node_list) + num_V + i) for i, idx in enumerate(inductors.index)} #inductor current
    
    print("Number of each component: \n R:", n_resistor, ", C:", n_capacitor, ", L:", n_inductor)
    print ("Number of sources:")
    print ("Voltage sources:", num_V, "Current Sources:", num_I)
    print("node_map: ", node_map)
      
    # Initialize matrices
    G = np.zeros([n+m, n+m])
    C = np.zeros([n+m, n+m])
    f_t = np.zeros(n+m)
    # x = np.zeros(n + num_V + n_inductor)
    x0 = np.zeros(n + num_V + n_inductor) #for initial conditions
    
    
    # Matrix stamping of G and C matrices
    for idx,comp in passive_comp_df.iterrows():
        type = comp['type']
        n1 = comp['node1']
        n2 = comp['node2']
        value = float(comp['value'])
        n1_idx = node_map.get(n1)
        n2_idx = node_map.get(n2)
        if type == 'resistor':
            stamp_resistor(G, n1_idx, n2_idx, value)
        elif type == 'capacitor':
            stamp_capacitor(C, n1_idx, n2_idx, value)
        elif type == 'inductor':
            ind_idx = ind_map[idx]
            stamp_inductor(G, C, n1_idx, n2_idx, ind_idx, value)
    
    for idx, comp in source_df.iterrows():
        type = comp['type']
        n1 = comp['node1']
        n2 = comp['node2']
        n1_idx = node_map.get(n1)
        n2_idx = node_map.get(n2)
    
        value = float(comp['value'])
        if type == 'voltage-source':
            V_idx = vs_map[idx]
            stamp_voltage_G(G, n1_idx, n2_idx, V_idx)       
    #stamping ends
    
    ac_sources = []
    dc_sources = []
    
    for idx, comp in source_df.iterrows():
        type = comp['type']
        n1 = comp['node1']
        n2 = comp['node2']
        n1_idx = node_map.get(n1)
        n2_idx = node_map.get(n2)
        source_type = comp['source_type']
        value = float(comp['value'])
        phase_angle = np.deg2rad(comp['phase_angle']) 
        frequency = float(comp['frequency'])
        indices = []
        signs = []
        if type == 'voltage-source':
            indices.append(vs_map[idx])
            signs.append(1.0)
        elif type == 'current-source':
            if n1_idx is not None:
                indices.append(n1_idx)
                signs.append(-1.0)
            if n2_idx is not None:
                indices.append(n2_idx)
                signs.append(1.0)
        
        source_data = {
            'indices': indices,
            'signs': signs,
            'value': value,
            'frequency': frequency,
            'phase_angle': phase_angle
        }
        
        if source_type == 'ac':
            ac_sources.append(source_data)
        else:
            dc_sources.append(source_data)
    
    #odes 
    def circuit_odes(t, x):
        F = np.zeros(n + m)
        
        for src in dc_sources:
            for i, idx in enumerate(src['indices']):
                F[idx] += src['signs'][i] * src['value']
                
        if t > 0: 
            for src in ac_sources:
                # V = A * sin(2*pi*f*t + phi)
                val = src['value'] * np.sin(2 * np.pi * src['frequency'] * t + src['phase_angle'])
                for i, idx in enumerate(src['indices']):
                    F[idx] += src['signs'][i] * val
                    
        return F - (G @ x)
    
    #Run simulation
    print("--- Starting Backward Euler Solver ---")
    dt = 1e-5                
    t_end = 0.05            
    steps = int(t_end / dt)
    time_points = np.linspace(0, t_end, steps)

    # A_effective = G + (C / dt)
    A_eff = G + (C / dt)
    x_current = x0.flatten() 
    results_x = [x_current]
    results_t = [0]

    for i in range(1, steps):
        t = time_points[i]
        source_vector = circuit_odes(t, np.zeros_like(x_current))
        rhs = source_vector + (C @ x_current) / dt
        x_new = np.linalg.solve(A_eff, rhs)
        results_x.append(x_new)
        results_t.append(t)
        x_current = x_new
    print("--- Solver Finished ---")
    
    sol_t = np.array(results_t)
    sol_y = np.array(results_x).T 
    # C (dx/dt) + Gx = F(t)
    #Graphs in subplot
    num_vars = len(node_map)
    fig, axes = plt.subplots(num_vars, 1, figsize=(8, 3 * num_vars), sharex=True)
    if num_vars == 1:
        axes = [axes]
    for i, (node_name, index) in enumerate(node_map.items()):
        ax = axes[i]
        ax.plot(sol_t, sol_y[index], color='tab:blue')
        ax.set_ylabel('V/A')
        ax.set_title(f'Node {node_name}')
        ax.grid(True)
    axes[-1].set_xlabel('Time (s)')
    plt.tight_layout() # Adjusts spacing so titles don't overlap
    plt.show()
    
file = 'netlist.json'
circuit_solver(file)
            
