import os
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText
from PIL import Image, ImageTk
import threading
import google.generativeai as genai
from dotenv import load_dotenv
import requests
from io import BytesIO

# Load environment variables
load_dotenv()

class IconCreationTool:
    def __init__(self, root):
        self.root = root
        self.root.title("RPG Icon Creation Tool")
        self.root.geometry("1100x800")
        
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
        
        self.items = [] # List of { 'name': str, 'path': str, 'prompt': str, 'selected': bool, 'generated_image': Image }
        self.selected_indices = set()
        self.last_clicked_index = None
        self.mapping_data = {}
        
        self.setup_ui()

    def setup_ui(self):
        # Top Control Bar
        ctrl_frame = ttk.Frame(self.root, padding=10)
        ctrl_frame.pack(side=tk.TOP, fill=tk.X)
        
        ttk.Button(ctrl_frame, text="1. Load Items Folder", command=self.load_folder).pack(side=tk.LEFT, padx=5)
        ttk.Button(ctrl_frame, text="2. Load Prompt Mapping (JSON)", command=self.load_mapping).pack(side=tk.LEFT, padx=5)
        ttk.Button(ctrl_frame, text="Select All", command=self.select_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(ctrl_frame, text="Deselect All", command=self.deselect_all).pack(side=tk.LEFT, padx=5)
        
        # Save Path Settings
        self.save_path = tk.StringVar(value=os.path.join(os.getcwd(), "output"))
        ttk.Label(ctrl_frame, text="Save Path:").pack(side=tk.LEFT, padx=(20, 5))
        ttk.Entry(ctrl_frame, textvariable=self.save_path, width=40).pack(side=tk.LEFT, padx=5)
        ttk.Button(ctrl_frame, text="Browse", command=self.browse_save_path).pack(side=tk.LEFT, padx=5)

        # Main Content Area (Two Columns)
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left Panel (List)
        list_frame = ttk.Frame(main_frame)
        list_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        ttk.Label(list_frame, text="Items (Shift+Click to range select)").pack(anchor=tk.W)
        
        self.tree = ttk.Treeview(list_frame, columns=("Prompt"), show="tree headings")
        self.tree.heading("#0", text="Item Name")
        self.tree.heading("Prompt", text="Prompt Snippet")
        self.tree.column("#0", width=200)
        self.tree.column("Prompt", width=500)
        self.tree.pack(fill=tk.BOTH, expand=True)
        
        self.tree.bind("<Button-1>", self.on_item_click)
        
        # Right Panel (Preview & Action)
        preview_frame = ttk.Frame(main_frame, width=300)
        preview_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=10)
        
        ttk.Label(preview_frame, text="Preview").pack(anchor=tk.W)
        
        # Wrapped in a Frame to force height
        self.preview_container = tk.Frame(preview_frame, width=256, height=256, bg="#333")
        self.preview_container.pack_propagate(False) # Prevent shrinking
        self.preview_container.pack(pady=10)
        
        self.preview_label = tk.Label(self.preview_container, text="No Image", bg="#333", fg="white")
        self.preview_label.pack(expand=True, fill=tk.BOTH)
        
        ttk.Button(preview_frame, text="GENERATE SELECTED", command=self.start_generation, style="Accent.TButton").pack(fill=tk.X, pady=20)
        
        self.progress = ttk.Progressbar(preview_frame, orient=tk.HORIZONTAL, mode='determinate')
        self.progress.pack(fill=tk.X, pady=5)
        
        self.status_label = ttk.Label(preview_frame, text="Ready")
        self.status_label.pack(anchor=tk.W)

        # Log Area at the bottom of Right Panel
        log_frame = ttk.LabelFrame(preview_frame, text="Activity Log", padding=5)
        log_frame.pack(fill=tk.BOTH, expand=True, pady=(20, 0))
        
        self.log_area = ScrolledText(log_frame, height=10, font=("Consolas", 9), state='disabled', bg="#1e1e1e", fg="#d4d4d4")
        self.log_area.pack(fill=tk.BOTH, expand=True)

    def log(self, message):
        """Append a message to the internal log area and print to console."""
        print(f"[LOG] {message}")
        def append():
            self.log_area.config(state='normal')
            self.log_area.insert(tk.END, f"{message}\n")
            self.log_area.see(tk.END)
            self.log_area.config(state='disabled')
        self.root.after(0, append)

    def browse_save_path(self):
        path = filedialog.askdirectory()
        if path:
            self.save_path.set(path)

    def load_folder(self):
        folder = filedialog.askdirectory(title="Select folder containing JSON items")
        if not folder: return
        
        self.items = []
        for f in os.listdir(folder):
            if f.endswith('.json'):
                path = os.path.join(folder, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        data = json.load(file)
                        name = data.get('name', f)
                        self.items.append({
                            'name': name,
                            'path': path,
                            'prompt': self.mapping_data.get(name, "No prompt found..."),
                            'selected': False,
                            'generated_url': None,
                            'image': None
                        })
                except:
                    pass
        self.refresh_list()

    def load_mapping(self):
        mapping_file = filedialog.askopenfilename(filetypes=[("JSON files", "*.json")])
        if not mapping_file: return
        
        with open(mapping_file, 'r', encoding='utf-8') as f:
            self.mapping_data = json.load(f)
            
        # Update existing items
        for item in self.items:
            item['prompt'] = self.mapping_data.get(item['name'], "No prompt found...")
        
        self.refresh_list()

    def refresh_list(self):
        for i in self.tree.get_children():
            self.tree.delete(i)
        
        for idx, item in enumerate(self.items):
            tag = "selected" if item['selected'] else ""
            self.tree.insert("", "end", iid=str(idx), text=f"{'[X] ' if item['selected'] else '[  ] '} {item['name']}", values=(item['prompt'][:100] + "...",), tags=(tag,))
        
        self.tree.tag_configure("selected", background="#e1f5fe")

    def on_item_click(self, event):
        item_id = self.tree.identify_row(event.y)
        if not item_id: return
        idx = int(item_id)
        
        if event.state & 0x0001: # SHIFT Key
            if self.last_clicked_index is not None:
                start = min(self.last_clicked_index, idx)
                end = max(self.last_clicked_index, idx)
                for i in range(start, end + 1):
                    self.items[i]['selected'] = True
            else:
                self.items[idx]['selected'] = not self.items[idx]['selected']
        else:
            self.items[idx]['selected'] = not self.items[idx]['selected']
        
        self.last_clicked_index = idx
        self.refresh_list()
        self.update_preview(idx)

    def select_all(self):
        for item in self.items: item['selected'] = True
        self.refresh_list()

    def deselect_all(self):
        for item in self.items: item['selected'] = False
        self.refresh_list()

    def update_preview(self, idx):
        item = self.items[idx]
        if item.get('image'):
            img = item['image'].resize((256, 256), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            self.preview_label.config(image=photo, text="")
            self.preview_label.image = photo
        else:
            self.preview_label.config(image='', text="No Image Generated Yet")

    def start_generation(self):
        selected = [idx for idx, item in enumerate(self.items) if item['selected']]
        if not selected:
            messagebox.showwarning("Warning", "No items selected for generation.")
            return
        
        if not self.api_key:
            messagebox.showerror("Error", "API Key not found in .env file.")
            return

        self.progress['maximum'] = len(selected)
        self.progress['value'] = 0
        
        thread = threading.Thread(target=self.generation_thread, args=(selected,))
        thread.daemon = True
        thread.start()

    def generation_thread(self, indices):
        output_dir = self.save_path.get()
        os.makedirs(output_dir, exist_ok=True)
        self.log(f"Starting bulk generation for {len(indices)} items using gemini-2.5-flash-image...")
        
        try:
            # Configure Model
            model = genai.GenerativeModel('gemini-2.5-flash-image')
        except Exception as e:
            self.log(f"Model initialization failed: {str(e)}")
            return

        for idx in indices:
            item = self.items[idx]
            self.log(f"Generating Icon: {item['name']}...")
            self.root.after(0, lambda: self.status_label.config(text=f"Generating: {item['name']}..."))
            
            try:
                if not self.api_key:
                    self.log("CRITICAL: API Key is missing. Check .env file.")
                    raise Exception("API Key missing")

                # Actual API Call with aspect ratio and quality hints in prompt if standard SDK doesn't have a direct arg
                # Usually Imagen-type models use specialized methods, but for Flash multimodal:
                prompt_enhancement = " (Aspect Ratio 1:1, game icon style, high quality, png format)"
                full_prompt = item['prompt'] + prompt_enhancement
                
                self.log(f"Sending prompt to Gemini...")
                response = model.generate_content(full_prompt)
                
                # Check for image data in parts
                image_data = None
                if response.candidates and response.candidates[0].content.parts:
                    for part in response.candidates[0].content.parts:
                        # Extract image blob/inline_data
                        if hasattr(part, 'inline_data'):
                            image_data = part.inline_data.data
                            break
                        elif hasattr(part, 'file_data'):
                             # If it returns a file reference
                             # This is less common for direct response
                             pass
                
                if not image_data:
                    # In some SDK versions/regions, the image might be accessible differently
                    # or the model might have returned text instead of an image
                    self.log(f"WARNING: No image data found in response for {item['name']}. Response might be text: {response.text[:50]}...")
                    raise Exception("No image in response")

                # Handle naming convention {spell_name}.png
                safe_name = item['name'].lower().replace(' ', '_')
                save_to = os.path.join(output_dir, f"{safe_name}.png")
                
                # Save the image data
                with open(save_to, 'wb') as f:
                    f.write(image_data)
                
                # Load for preview
                img = Image.open(BytesIO(image_data))
                img = img.resize((256, 256), Image.Resampling.LANCZOS)
                
                item['image'] = img
                item['selected'] = False
                item['generated_status'] = "Success"
                self.log(f"SUCCESS: Generated {os.path.basename(save_to)}")
                
                self.root.after(0, lambda m=f"Saved to {os.path.basename(save_to)}": self.status_label.config(text=m))
                
            except Exception as e:
                self.log(f"FAILED: {item['name']} - {str(e)}")
                item['generated_status'] = f"Error: {str(e)}"
                self.root.after(0, lambda m=str(e): self.status_label.config(text=f"Error: {m}"))
            
            self.root.after(0, lambda i=idx: self.update_after_gen(i))
            self.root.after(0, lambda: self.progress.step(1))
            
        self.log("Bulk generation work complete.")
        self.root.after(0, lambda: self.status_label.config(text="Bulk Generation Complete"))

    def update_after_gen(self, idx):
        self.refresh_list()
        self.update_preview(idx)

if __name__ == "__main__":
    root = tk.Tk()
    app = IconCreationTool(root)
    root.mainloop()
