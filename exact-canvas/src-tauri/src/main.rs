// Sembunyikan jendela konsol tambahan di Windows rilis.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    exact_canvas_lib::run()
}
