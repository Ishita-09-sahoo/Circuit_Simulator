class Resistor:
    def __init__(self, node1, node2, resistance):
        self.node1 = node1
        self.node2 = node2
        self.resistance = resistance

class Inductor:
    def __init__(self, node1, node2, inductance):
        self.node1 = node1
        self.node2 = node2
        self.inductance = inductance
        
class Capacitor:
    def __init__(self, node1, node2, capacitance):
        self.node1 = node1
        self.node2 = node2
        self.inductance = capacitance

class VoltageSource:
    def __init__(self, node_pos, node_neg, value, source_type='DC', waveform_params=None):
        self.node_pos = node_pos
        self.node_neg = node_neg
        self.value = value
        self.source_type = source_type
        self.waveform_params = waveform_params if waveform_params is not None else {}

    # Method needed for Transient Analysis
    def get_voltage_at_time(self, time):
        if self.source_type == 'DC':
            return self.value
        # Add logic for AC/sinusoidal or pulse waveforms here
        # E.g., if self.source_type == 'AC': return self.value * sin(2 * pi * f * time + phase)
        return self.value
    
class CurrentSource:
    def __init__(self, node_out, node_in, value, source_type='DC', waveform_params=None):
        self.node_out = node_out
        self.node_in = node_in
        self.value = value
        self.source_type = source_type
        self.waveform_params = waveform_params if waveform_params is not None else {}

    # Method needed for Transient Analysis
    def get_current_at_time(self, time):
        if self.source_type == 'DC':
            return self.value
        # Add logic for AC/sinusoidal or pulse waveforms here
        return self.value