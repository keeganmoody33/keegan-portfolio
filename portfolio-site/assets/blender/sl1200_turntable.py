"""
Technics SL-1200 MK2 - Stylized Turntable for Blender
Run this script in Blender's Scripting tab

Based on official dimensions:
- Base: 453mm x 353mm x 162mm
- Platter: 332mm diameter
- Tonearm: ~230mm effective length
"""

import bpy
import math

# Clear existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Scale factor (1 unit = 10cm for easier viewing)
scale = 0.01

# ============================================
# BASE UNIT
# ============================================
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.081 * scale * 100))
base = bpy.context.active_object
base.name = "Base"
base.scale = (0.453 * scale * 100 / 2, 0.353 * scale * 100 / 2, 0.162 * scale * 100 / 2)

# Bevel the edges for that SL-1200 look
bpy.ops.object.modifier_add(type='BEVEL')
base.modifiers["Bevel"].width = 0.02
base.modifiers["Bevel"].segments = 3

# ============================================
# PLATTER (the spinning part)
# ============================================
platter_z = 0.17 * scale * 100
bpy.ops.mesh.primitive_cylinder_add(radius=0.166 * scale * 100, depth=0.02 * scale * 100, location=(0.05, 0, platter_z))
platter = bpy.context.active_object
platter.name = "Platter"

# Platter dots (speed indicator dots around edge)
for i in range(8):
    angle = i * (2 * math.pi / 8)
    x = 0.05 + 0.14 * scale * 100 * math.cos(angle)
    y = 0.14 * scale * 100 * math.sin(angle)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.005 * scale * 100, depth=0.005 * scale * 100, location=(x, y, platter_z + 0.012))
    dot = bpy.context.active_object
    dot.name = f"PlatterDot_{i}"

# ============================================
# SLIPMAT
# ============================================
bpy.ops.mesh.primitive_cylinder_add(radius=0.15 * scale * 100, depth=0.003 * scale * 100, location=(0.05, 0, platter_z + 0.015))
slipmat = bpy.context.active_object
slipmat.name = "Slipmat"

# ============================================
# RECORD (vinyl)
# ============================================
bpy.ops.mesh.primitive_cylinder_add(radius=0.15 * scale * 100, depth=0.002 * scale * 100, location=(0.05, 0, platter_z + 0.02))
record = bpy.context.active_object
record.name = "Record"

# Record label (center)
bpy.ops.mesh.primitive_cylinder_add(radius=0.05 * scale * 100, depth=0.003 * scale * 100, location=(0.05, 0, platter_z + 0.022))
label = bpy.context.active_object
label.name = "RecordLabel"

# Record spindle hole
bpy.ops.mesh.primitive_cylinder_add(radius=0.004 * scale * 100, depth=0.03 * scale * 100, location=(0.05, 0, platter_z + 0.01))
spindle = bpy.context.active_object
spindle.name = "Spindle"

# ============================================
# TONEARM BASE
# ============================================
arm_base_x = -0.15
arm_base_y = 0.1
bpy.ops.mesh.primitive_cylinder_add(radius=0.025 * scale * 100, depth=0.04 * scale * 100, location=(arm_base_x, arm_base_y, platter_z))
arm_base = bpy.context.active_object
arm_base.name = "TonearmBase"

# ============================================
# TONEARM (S-shaped)
# ============================================
# Simplified as straight arm for stylized look
arm_length = 0.23 * scale * 100
arm_angle = math.radians(-30)  # Angle toward record

# Vertical post
bpy.ops.mesh.primitive_cylinder_add(radius=0.008 * scale * 100, depth=0.05 * scale * 100, location=(arm_base_x, arm_base_y, platter_z + 0.04))
arm_post = bpy.context.active_object
arm_post.name = "TonearmPost"

# Horizontal arm
bpy.ops.mesh.primitive_cylinder_add(radius=0.005 * scale * 100, depth=arm_length, location=(arm_base_x + arm_length/2 * math.cos(arm_angle), arm_base_y + arm_length/2 * math.sin(arm_angle), platter_z + 0.065))
arm = bpy.context.active_object
arm.name = "Tonearm"
arm.rotation_euler = (0, math.radians(90), arm_angle)

# Headshell (cartridge holder)
headshell_x = arm_base_x + arm_length * math.cos(arm_angle)
headshell_y = arm_base_y + arm_length * math.sin(arm_angle)
bpy.ops.mesh.primitive_cube_add(size=0.02 * scale * 100, location=(headshell_x, headshell_y, platter_z + 0.06))
headshell = bpy.context.active_object
headshell.name = "Headshell"
headshell.scale = (1.5, 0.8, 0.5)
headshell.rotation_euler = (0, 0, arm_angle)

# Stylus/needle
bpy.ops.mesh.primitive_cone_add(radius1=0.003 * scale * 100, radius2=0, depth=0.015 * scale * 100, location=(headshell_x + 0.01, headshell_y, platter_z + 0.045))
stylus = bpy.context.active_object
stylus.name = "Stylus"
stylus.rotation_euler = (math.radians(180), 0, 0)

# ============================================
# PITCH SLIDER
# ============================================
bpy.ops.mesh.primitive_cube_add(size=0.01 * scale * 100, location=(0.18, -0.08, platter_z - 0.02))
pitch = bpy.context.active_object
pitch.name = "PitchSlider"
pitch.scale = (0.5, 3, 0.3)

# ============================================
# START/STOP BUTTON
# ============================================
bpy.ops.mesh.primitive_cylinder_add(radius=0.015 * scale * 100, depth=0.01 * scale * 100, location=(-0.18, -0.12, platter_z - 0.01))
start_btn = bpy.context.active_object
start_btn.name = "StartButton"

# ============================================
# POWER BUTTON
# ============================================
bpy.ops.mesh.primitive_cylinder_add(radius=0.01 * scale * 100, depth=0.008 * scale * 100, location=(-0.18, 0.12, platter_z - 0.01))
power_btn = bpy.context.active_object
power_btn.name = "PowerButton"

# ============================================
# MATERIALS (basic colors for reference)
# ============================================

# Base - dark gray/black
mat_base = bpy.data.materials.new(name="BaseMaterial")
mat_base.diffuse_color = (0.05, 0.05, 0.05, 1)
base.data.materials.append(mat_base)

# Platter - silver
mat_platter = bpy.data.materials.new(name="PlatterMaterial")
mat_platter.diffuse_color = (0.7, 0.7, 0.7, 1)
platter.data.materials.append(mat_platter)

# Record - black
mat_record = bpy.data.materials.new(name="RecordMaterial")
mat_record.diffuse_color = (0.02, 0.02, 0.02, 1)
record.data.materials.append(mat_record)

# Label - can be customized (lecturesfrom branding)
mat_label = bpy.data.materials.new(name="LabelMaterial")
mat_label.diffuse_color = (0.8, 0.4, 0.1, 1)  # Orange accent
label.data.materials.append(mat_label)

# ============================================
# CAMERA SETUP (45° POV per spec)
# ============================================
bpy.ops.object.camera_add(location=(0.4, -0.4, 0.5))
camera = bpy.context.active_object
camera.name = "TurntableCamera"
camera.rotation_euler = (math.radians(55), 0, math.radians(45))
bpy.context.scene.camera = camera

# ============================================
# LIGHTING
# ============================================
bpy.ops.object.light_add(type='SUN', location=(1, -1, 2))
sun = bpy.context.active_object
sun.name = "KeyLight"
sun.data.energy = 3

bpy.ops.object.light_add(type='AREA', location=(-1, 1, 1))
fill = bpy.context.active_object
fill.name = "FillLight"
fill.data.energy = 100

print("SL-1200 MK2 turntable created!")
print("Export as GLTF: File > Export > glTF 2.0 (.glb/.gltf)")
