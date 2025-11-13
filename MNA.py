import json
import numpy as np
import pandas as pd
import sympy as sp

with open('netlist.json', 'r') as f:
    netlist_data = json.load(f) 
    
components_df = pd.DataFrame(netlist_data['components'])

components_df = pd.DataFrame(netlist_data['components'])
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

tot_nodes = 4 #exlcuding ground #modify it acc to data from json
s = sp.symbols('s')

#G matrix

G = sp.Matrix.zeros(tot_nodes, tot_nodes)
for _, comp in components_df.iterrows():
    type = comp['type']
    node_1 = comp['node1']
    node_2 = comp['node2']
    value = float(comp['value'])
    
    #admittance
    if type == 'resistor':
        y = 1/value
    elif type == 'capacitor':
        y = s * value
    elif type == 'inductor':
        y = 1/(s*value)
    else:
        continue
    
    #matrix input
    if node_1 == 0:
        G[node_2-1, node_2-1] += y
    if node_1 != 0:
        G[node_1-1, node_1-1] += y
    if node_1 != 0 and node_2 !=0:
        G[node_1-1, node_2-1] -= y
        G[node_2-1, node_1-1] -= y
    else:
        continue
       
    