const app = {
    // --- State ---
    mobileMap: null,
    isSafe: false,
    isVolunteer: false,
    hasUploadedImage: false,

    // --- Navigation System ---
    navigate: function(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`view-${screenId}`).classList.add('active');

        if (screenId === 'sos') {
            this.triggerSOS();
        } else if (screenId === 'contacts') {
            this.renderContacts();
        } else if (screenId === 'airdrop') {
            document.getElementById('checkMedical').checked = false;
            document.getElementById('checkFood').checked = false;
            document.getElementById('checkBlankets').checked = false;
            document.getElementById('airdropNote').value = '';
        } else if (screenId === 'nearby') {
            // Fix Leaflet gray area / sizing issue
            setTimeout(() => {
                if (this.mobileMap) {
                    this.mobileMap.invalidateSize();
                    this.loadRealPOIs(this.mobileMap); // Force a fresh search
                }
            }, 300);
        }
    },

    // --- SAHAYAK Chatbot Logic ---
    sendChatMessage: async function() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if(!text) return;

        // 1. Add user message
        this.appendChatMessage(text, 'user');
        input.value = '';

        // 2. Add loading bot message
        const loadingId = 'load-' + Date.now();
        this.appendChatMessage('<i class="fas fa-circle-notch fa-spin"></i> Thinking...', 'bot', loadingId);

        // 3. Call Gemini API
        try {
            // Using the API key provided by the user
            const apiKey = 'AIzaSyCG_STk2bmusDMhyhP2EvM08LPdwbkiXVc';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            
            // Injecting the local Database as Context
            const dbContext = JSON.stringify(SAHAYAK_DB);
            
            const systemPrompt = `You are SAHAYAK, an AI disaster response assistant. Provide short, practical, calm, and highly accurate emergency advice. Keep answers brief (1-3 sentences). 
CRITICAL RULE: You must base your emergency advice on the following authorized CrisisConnect database guidelines: ${dbContext}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: [{
                        parts: [{ text: text }]
                    }]
                })
            });

            const data = await response.json();
            
            // Remove loading
            const loadMsg = document.getElementById(loadingId);
            if(loadMsg) loadMsg.remove();

            if (data.candidates && data.candidates[0].content.parts[0].text) {
                // Formatting basic markdown (bold)
                let reply = data.candidates[0].content.parts[0].text;
                reply = reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                this.appendChatMessage(reply, 'bot');
            } else {
                this.appendChatMessage("I'm sorry, I couldn't process that request right now.", 'bot');
            }

        } catch (error) {
            console.error("Gemini API Error:", error);
            const loadMsg = document.getElementById(loadingId);
            if(loadMsg) loadMsg.remove();
            this.appendChatMessage("Connection error. Please try again.", 'bot');
        }
    },

    appendChatMessage: function(text, sender, id = null) {
        const container = document.getElementById('chatContainer');
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        if(id) msgDiv.id = id;
        
        msgDiv.innerHTML = `<div class="bubble">${text}</div>`;
        container.appendChild(msgDiv);
        
        // Auto scroll
        container.scrollTop = container.scrollHeight;
    },

    // --- Settings & UI Toggles ---
    toggleSettingsMenu: function() {
        document.getElementById('settingsDropdown').classList.toggle('hidden');
    },

    toggleDeviceView: function() {
        document.body.classList.toggle('desktop-mode');
        this.toggleSettingsMenu();
        // Trigger map resize since container changed
        if(adminSim.map) adminSim.map.invalidateSize();
    },

    toggleDarkTheme: function() {
        document.body.classList.toggle('super-dark');
        this.toggleSettingsMenu();
    },

    // --- Home Screen Toggles ---
    toggleSafe: function() {
        this.isSafe = !this.isSafe;
        const btn = document.getElementById('btnMarkSafe');
        const adminSafeCount = document.getElementById('adminSafe');
        let currentCount = parseInt(adminSafeCount.innerText.replace(/,/g, ''));

        if(this.isSafe) {
            btn.classList.add('active');
            btn.innerHTML = `<i class="fas fa-check-circle"></i> Marked Safe`;
            adminSafeCount.innerText = (currentCount + 1).toLocaleString();
            
            // Send to feed
            const now = new Date();
            adminSim.addFeedItem("User marked themselves as SAFE", { level: "Low", class: "low" }, now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), true);
        } else {
            btn.classList.remove('active');
            btn.innerHTML = `<i class="fas fa-check-circle"></i> Mark as Safe`;
            adminSafeCount.innerText = (currentCount - 1).toLocaleString();
        }
    },

    toggleVolunteer: function() {
        this.isVolunteer = !this.isVolunteer;
        const btn = document.getElementById('btnVolunteer');
        const adminVolCount = document.getElementById('adminVolunteers');
        let currentCount = parseInt(adminVolCount.innerText.replace(/,/g, ''));

        if(this.isVolunteer) {
            btn.classList.add('active');
            btn.innerHTML = `<i class="fas fa-hands-helping"></i> Volunteering`;
            adminVolCount.innerText = (currentCount + 1).toLocaleString();
            
            // Plot volunteer on map
            adminSim.addMapMarker(false, null, 'volunteer');
        } else {
            btn.classList.remove('active');
            btn.innerHTML = `<i class="fas fa-hands-helping"></i> Volunteer`;
            adminVolCount.innerText = (currentCount - 1).toLocaleString();
        }
    },

    // --- Incident Reporting System ---
    handleFileUpload: function(event) {
        if(event.target.files && event.target.files[0]) {
            this.hasUploadedImage = true;
            document.getElementById('uploadArea').classList.add('hidden');
            document.getElementById('uploadPreview').classList.remove('hidden');
        }
    },

    submitReport: function() {
        const type = document.getElementById('reportType').value;
        const desc = document.getElementById('reportDesc').value;
        
        let feedText = `Reported: ${type}`;
        if (this.hasUploadedImage) {
            feedText += ` <i class="fas fa-image text-primary" style="margin-left:8px;" title="Image Attached"></i>`;
        }

        const now = new Date();
        adminSim.addFeedItem(feedText, { level: "Medium", class: "medium" }, now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), true);
        adminSim.addMapMarker(true); // Plot it

        alert("Incident reported successfully. Authorities have been notified.");
        this.navigate('home');
    },

    // --- Airdrop Request System ---
    submitAirdropRequest: function() {
        const needs = [];
        if(document.getElementById('checkMedical').checked) needs.push("Medical");
        if(document.getElementById('checkFood').checked) needs.push("Food/Water");
        if(document.getElementById('checkBlankets').checked) needs.push("Blankets");
        
        const note = document.getElementById('airdropNote').value.trim();
        
        if (needs.length === 0 && !note) {
            alert("Please select at least one supply or add a note.");
            return;
        }

        let feedMsg = `<b>Airdrop Requested</b><br>Location: Lat 20.5937, Lng 75.8577<br>Needs: ${needs.join(", ") || "Custom"}`;
        if (note) feedMsg += `<br>Note: "${note}"`;

        const now = new Date();
        adminSim.addFeedItem(feedMsg, { level: "High", class: "high" }, now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), true);
        adminSim.addMapMarker(true, [20.5937, 75.8577], 'sos'); // Plot request location

        alert("Airdrop request transmitted to Admin Command Center.");
        this.navigate('home');
    },

    // --- Safety Guidelines ---
    toggleSafetyCard: function(headerElement) {
        const card = headerElement.parentElement;
        card.classList.toggle('expanded');
    },

    // --- SOS System ---
    triggerSOS: function() {
        const locationText = document.getElementById('sosLocationText');
        const smsLog = document.getElementById('smsLog');
        
        locationText.innerText = "Acquiring GPS coordinates...";
        Array.from(smsLog.children).forEach(child => {
            if (!child.classList.contains('log-title')) {
                smsLog.removeChild(child);
            }
        });

        setTimeout(() => {
            locationText.innerHTML = `Lat: 20.5937, Lng: 75.8577<br><span class="text-success">Location Acquired!</span>`;
            
            let contacts = this.getContacts();
            if (contacts.length === 0) contacts = [{name: 'Emergency Services', phone: '911'}];
            
            let delay = 1000;
            contacts.forEach(contact => {
                setTimeout(() => {
                    this.addSmsLog(`SMS sent to ${contact.name}`);
                }, delay);
                delay += 1000;
            });

            setTimeout(() => {
                const now = new Date();
                adminSim.addFeedItem("Emergency SOS Triggered", { level: "High", class: "high" }, now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), true);
                adminSim.addMapMarker(true, [20.5937, 75.8577], 'sos');
                this.addSmsLog(`Alerted nearby authorities (Admin)`);
            }, delay + 500);

        }, 1500);
    },

    cancelSOS: function() {
        if(confirm("Cancel the SOS?")) this.navigate('home');
    },

    addSmsLog: function(msg) {
        const smsLog = document.getElementById('smsLog');
        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
        smsLog.appendChild(item);
    },

    // --- Contacts Management System ---
    getContacts: function() {
        const stored = localStorage.getItem('crisisContacts');
        if (stored) return JSON.parse(stored);
        return [
            { id: 1, name: 'Mom', phone: '+1 555-0192' },
            { id: 2, name: 'Brother', phone: '+1 555-0193' }
        ];
    },
    saveContacts: function(contacts) { localStorage.setItem('crisisContacts', JSON.stringify(contacts)); },
    renderContacts: function() {
        const list = document.getElementById('contactsList');
        const contacts = this.getContacts();
        list.innerHTML = '';
        if (contacts.length === 0) {
            list.innerHTML = '<p class="text-muted text-center mt-20">No contacts added yet.</p>';
            return;
        }
        contacts.forEach(c => {
            const initial = c.name.charAt(0).toUpperCase();
            list.innerHTML += `
                <div class="contact-card">
                    <div class="contact-info">
                        <div class="contact-avatar">${initial}</div>
                        <div>
                            <div style="font-weight:600">${c.name}</div>
                            <div class="text-muted" style="font-size:0.85rem">${c.phone}</div>
                        </div>
                    </div>
                    <div class="contact-actions">
                        <i class="fas fa-trash" onclick="app.deleteContact(${c.id})"></i>
                    </div>
                </div>
            `;
        });
    },
    openAddContactModal: function() { document.getElementById('addContactModal').classList.remove('hidden'); },
    closeAddContactModal: function() { 
        document.getElementById('addContactModal').classList.add('hidden');
        document.getElementById('contactName').value = '';
        document.getElementById('contactPhone').value = '';
    },
    saveContact: function() {
        const name = document.getElementById('contactName').value;
        const phone = document.getElementById('contactPhone').value;
        if (!name || !phone) return alert("Please fill both fields");
        const contacts = this.getContacts();
        contacts.push({ id: Date.now(), name, phone });
        this.saveContacts(contacts);
        this.closeAddContactModal();
        this.renderContacts();
    },
    deleteContact: function(id) {
        if(confirm("Delete this contact?")) {
            let contacts = this.getContacts();
            contacts = contacts.filter(c => c.id !== id);
            this.saveContacts(contacts);
            this.renderContacts();
        }
    },

    // --- Maps & POIs ---
    userLoc: [20.5937, 75.8577], // Default
    currentPOIs: [],
    routingControl: null,

    createCustomIcon: function(iconClass, color) {
        return L.divIcon({
            html: `<div style="background:${color}; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.5); opacity:0.8; box-shadow:0 0 5px rgba(0,0,0,0.3);"><i class="${iconClass}" style="color:white; font-size:0.6rem;"></i></div>`,
            className: 'custom-leaflet-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    },

    // Fallback POIs for Bhopal / Central India region — used when Overpass API is unreachable
    fallbackPOIs: [
        { lat: 23.2599, lon: 77.4126, name: "AIIMS Bhopal", type: "hospital" },
        { lat: 23.2330, lon: 77.4340, name: "Hamidia Hospital", type: "hospital" },
        { lat: 23.2505, lon: 77.4023, name: "Bansal Hospital", type: "hospital" },
        { lat: 23.2200, lon: 77.4100, name: "Chirayu Medical College & Hospital", type: "hospital" },
        { lat: 23.2680, lon: 77.4150, name: "Bhopal Memorial Hospital", type: "hospital" },
        { lat: 23.2450, lon: 77.4500, name: "Jawaharlal Nehru Cancer Hospital", type: "hospital" },
        { lat: 23.2540, lon: 77.4090, name: "Noble Hospital & Research Centre", type: "hospital" },
        { lat: 23.2610, lon: 77.4250, name: "TT Nagar Police Station", type: "police" },
        { lat: 23.2350, lon: 77.4020, name: "Habibganj Police Station", type: "police" },
        { lat: 23.2700, lon: 77.4000, name: "Shahpura Police Station", type: "police" },
        { lat: 23.2480, lon: 77.4330, name: "MP Nagar Fire Station", type: "fire_station" },
        { lat: 23.2650, lon: 77.4090, name: "Bhopal Central Fire Station", type: "fire_station" },
        { lat: 23.2300, lon: 77.3900, name: "Misrod Fire Station", type: "fire_station" },
        { lat: 23.2590, lon: 77.4200, name: "NDRF 7th Battalion Bhopal", type: "ndrf" },
        { lat: 23.2410, lon: 77.4180, name: "Arera Colony Police Outpost", type: "police" },
        { lat: 22.7196, lon: 75.8577, name: "MY Hospital Indore", type: "hospital" },
        { lat: 22.7240, lon: 75.8650, name: "CHL Hospital Indore", type: "hospital" },
        { lat: 22.7150, lon: 75.8700, name: "Bombay Hospital Indore", type: "hospital" },
        { lat: 22.7280, lon: 75.8500, name: "Indore Fire Station", type: "fire_station" },
        { lat: 22.7100, lon: 75.8600, name: "Palasia Police Station Indore", type: "police" },
    ],

    // Debounce timer to avoid hammering API on every map pan
    _poiDebounceTimer: null,

    loadRealPOIs: async function(mapInstance) {
        const center = mapInstance.getCenter();
        const radius = 30000; 
        
        // Update userLoc to current center so distances are accurate to the view
        this.userLoc = [center.lat, center.lng];
        
        const query = `[out:json][timeout:10];
            (
              node["amenity"~"hospital|police|fire_station"](around:${radius},${center.lat},${center.lng});
              node["emergency"~"rescue_station|ambulance_station"](around:${radius},${center.lat},${center.lng});
              node["amenity"~"clinic|doctors"](around:${radius},${center.lat},${center.lng});
            );
            out body 40;`;
        
        const list = document.getElementById('nearbyList');
        const mapContainer = document.querySelector('.map-view-container');
        if (mapContainer) mapContainer.classList.add('loading');

        if (list) list.innerHTML = '<div class="text-center p-20 text-muted"><i class="fas fa-circle-notch fa-spin"></i> Scanning 30km...</div>';

        // Clear existing markers to prevent overlap
        if (this.poiLayers) this.poiLayers.clearLayers();
        else this.poiLayers = L.layerGroup().addTo(mapInstance);

        // Visual scan range circle
        L.circle(center, { radius: radius, color: 'var(--accent-primary)', fillOpacity: 0.05, weight: 1 }).addTo(this.poiLayers);

        const mirrors = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://lz4.overpass-api.de/api/interpreter',
            'https://overpass.osm.ch/api/interpreter',
            'https://overpass.nchc.org.tw/api/interpreter'
        ];

        let success = false;
        for (let mirror of mirrors) {
            try {
                // AbortController with 8-second timeout per mirror
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(`${mirror}?data=${encodeURIComponent(query)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if(!response.ok) continue; 
                const data = await response.json();
                
                this.currentPOIs = data.elements.map(el => {
                    let type = el.tags.amenity || el.tags.emergency || 'rescue';
                    if (type.includes('hospital') || type.includes('clinic') || type.includes('doctor')) type = 'hospital';
                    if (el.tags.name && el.tags.name.includes('NDRF')) type = 'ndrf';
                    
                    return {
                        lat: el.lat,
                        lon: el.lon,
                        name: el.tags.name || `Emergency ${type.toUpperCase()}`,
                        type: type
                    };
                });

                if (this.currentPOIs.length > 0) {
                    this.plotPOIsOnMap(this.poiLayers);
                    this.updateNearbyList();
                    success = true;
                    break; 
                }
            } catch (e) { console.warn(`Mirror ${mirror} failed:`, e.message); }
        }

        // Fallback: use built-in POI data when all mirrors fail
        if (!success) {
            console.log('All Overpass mirrors failed. Using fallback POI data.');
            // Filter fallback POIs to those within ~40km of the current map center
            this.currentPOIs = this.fallbackPOIs.filter(p => {
                return this.getDistance(center.lat, center.lng, p.lat, p.lon) <= 40;
            });

            if (this.currentPOIs.length > 0) {
                this.plotPOIsOnMap(this.poiLayers);
                this.updateNearbyList('offline');
            } else {
                // No fallback data for this region either - Show the specific "Mirror Timeout." error from screenshot
                if (list) {
                    list.innerHTML = `
                        <div class="mirror-error-container">
                            <p class="mirror-error-text">Mirror Timeout.</p>
                            <button class="btn btn-primary retry-btn" onclick="app.loadRealPOIs(app.mobileMap)">Try Again</button>
                        </div>
                    `;
                }
            }
        }
        if (mapContainer) mapContainer.classList.remove('loading');
    },

    // Helper to plot POI markers on a given layer group
    plotPOIsOnMap: function(layerGroup) {
        this.currentPOIs.forEach(p => {
            let color = p.type === 'hospital' ? '#ef4444' : (p.type === 'police' ? '#3b82f6' : (p.type === 'ndrf' ? '#10b981' : '#f59e0b'));
            let icon = p.type === 'hospital' ? 'fa-hospital' : (p.type === 'police' ? 'fa-shield-alt' : (p.type === 'ndrf' ? 'fa-person-military-pointing' : 'fa-fire'));
            const marker = L.marker([p.lat, p.lon], { icon: this.createCustomIcon(`fas ${icon}`, color) }).addTo(layerGroup);
            marker.bindPopup(`<b>${p.name}</b><br>${p.type.toUpperCase()}`);
        });
    },

    updateNearbyList: function(mode = 'online') {
        const list = document.getElementById('nearbyList');
        if (!list) return;
        
        if (this.currentPOIs.length === 0) {
            list.innerHTML = '<div class="text-center p-20 text-muted">No stations found in view. Pan the map to search.</div>';
            return;
        }

        // Sort by distance from userLoc
        const sorted = this.currentPOIs.map(p => {
            const dist = this.getDistance(this.userLoc[0], this.userLoc[1], p.lat, p.lon);
            return { ...p, dist };
        }).sort((a, b) => a.dist - b.dist);

        let headerHTML = '';
        if (mode === 'offline') {
            headerHTML = '<div class="text-center p-10" style="background:rgba(245,158,11,0.15); border-radius:8px; margin:5px 10px; font-size:0.8rem; color:#f59e0b;"><i class="fas fa-database"></i> Showing cached local data (API unavailable)</div>';
        }

        list.innerHTML = headerHTML + sorted.map(p => {
            let icon = 'fa-hospital';
            if (p.type === 'police') icon = 'fa-building-shield';
            if (p.type === 'fire_station') icon = 'fa-fire-extinguisher';
            if (p.type === 'ndrf') icon = 'fa-person-military-pointing';
            
            return `
                <div class="nearby-item" onclick="app.calculateRoute(${p.lat}, ${p.lon})">
                    <div class="icon-box ${p.type}"><i class="fas ${icon}"></i></div>
                    <div class="details">
                        <h4>${p.name}</h4>
                        <p>${p.dist.toFixed(1)} km away • ${p.type.toUpperCase()}</p>
                    </div>
                    <i class="fas fa-directions text-primary"></i>
                </div>
            `;
        }).join('');
    },

    getDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2-lat1) * Math.PI / 180;
        const dLon = (lon2-lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

    calculateRoute: function(destLat, destLon) {
        if (this.routingControl) {
            this.mobileMap.removeControl(this.routingControl);
        }

        this.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(this.userLoc[0], this.userLoc[1]),
                L.latLng(destLat, destLon)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            lineOptions: { styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6 }] },
            createMarker: function() { return null; } // Don't show routing markers
        }).addTo(this.mobileMap);
        
        // Auto-scroll to map in nearby view if on mobile
        document.getElementById('mobileMap').scrollIntoView({ behavior: 'smooth' });
    },

    initMobileMap: function() {
        this.mobileMap = L.map('mobileMap').setView([23.2599, 77.4126], 13);
        
        L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'], attribution: '&copy; Google Maps'
        }).addTo(this.mobileMap);

        const locateControl = L.control.locate({ flyTo: true }).addTo(this.mobileMap);
        L.control.scale().addTo(this.mobileMap); // Add scale for distance awareness
        
        this.mobileMap.on('locationfound', (e) => {
            this.userLoc = [e.latlng.lat, e.latlng.lng];
            this.updateNearbyList();
        });

        this.loadRealPOIs(this.mobileMap);
        // Debounced moveend to avoid excessive API calls
        this.mobileMap.on('moveend', () => {
            clearTimeout(this._poiDebounceTimer);
            this._poiDebounceTimer = setTimeout(() => this.loadRealPOIs(this.mobileMap), 1000);
        });
    },

    // --- Draggable FAB ---
    makeFabDraggable: function() {
        const fab = document.querySelector('.fab-sahayak');
        if (!fab) return;

        let isDragging = false;
        let hasMoved = false;
        let startX, startY, initialX, initialY;

        const onTouchStart = (e) => {
            isDragging = true;
            hasMoved = false;
            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            initialX = fab.offsetLeft;
            initialY = fab.offsetTop;
            
            // Remove pulse while dragging
            fab.classList.remove('pulse-bot');
            fab.style.transition = 'none'; 
        };

        const onTouchMove = (e) => {
            if (!isDragging) return;
            const touch = e.touches ? e.touches[0] : e;
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) hasMoved = true;

            const container = document.getElementById('mobileFrame');
            const maxX = container.clientWidth - fab.clientWidth;
            const maxY = container.clientHeight - fab.clientHeight;

            let newX = initialX + deltaX;
            let newY = initialY + deltaY;

            // Constrain to container
            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX > maxX) newX = maxX;
            if (newY > maxY) newY = maxY;

            // Reset right/bottom defaults since we are using left/top absolute positioning
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
            fab.style.left = `${newX}px`;
            fab.style.top = `${newY}px`;
            e.preventDefault(); // prevent scrolling
        };

        const onTouchEnd = (e) => {
            isDragging = false;
            fab.style.transition = 'transform 0.2s';
            if (hasMoved) {
                // Prevent the click event if it was dragged
                setTimeout(() => hasMoved = false, 50);
            }
        };

        fab.addEventListener('mousedown', onTouchStart);
        document.addEventListener('mousemove', onTouchMove);
        document.addEventListener('mouseup', onTouchEnd);

        fab.addEventListener('touchstart', onTouchStart, {passive: false});
        document.addEventListener('touchmove', onTouchMove, {passive: false});
        document.addEventListener('touchend', onTouchEnd);

        // Override the onclick to respect dragging
        const originalOnClick = fab.onclick;
        fab.onclick = (e) => {
            if (hasMoved) { e.preventDefault(); return false; }
            app.navigate('chatbot');
        };
    },

    // --- Dynamic Resource Allocation ---
    resources: { medical: 85, fire: 60, rescue: 90, food: 40 },
    
    updateResourceUI: function() {
        document.getElementById('valMedical').innerText = this.resources.medical;
        document.getElementById('barMedical').style.width = this.resources.medical + '%';
        
        document.getElementById('valFire').innerText = this.resources.fire;
        document.getElementById('barFire').style.width = this.resources.fire + '%';
        
        document.getElementById('valRescue').innerText = this.resources.rescue;
        document.getElementById('barRescue').style.width = this.resources.rescue + '%';
        
        document.getElementById('valFood').innerText = this.resources.food;
        document.getElementById('barFood').style.width = this.resources.food + '%';
    },

    depleteResource: function(type) {
        let dec = Math.floor(Math.random() * 5) + 1; // deplete by 1-5%
        if (type === 'Medical Emergency' || type === 'Need Evacuation') {
            this.resources.medical = Math.max(0, this.resources.medical - dec);
        } else if (type === 'Fire reported') {
            this.resources.fire = Math.max(0, this.resources.fire - (dec + 2));
        } else if (type === 'Trapped under debris') {
            this.resources.rescue = Math.max(0, this.resources.rescue - dec);
        } else if (type === 'Flood waters rising') {
            this.resources.food = Math.max(0, this.resources.food - dec);
            this.resources.rescue = Math.max(0, this.resources.rescue - dec);
        }
        this.updateResourceUI();
    },

    restockResources: function() {
        this.resources = { medical: 100, fire: 100, rescue: 100, food: 100 };
        this.updateResourceUI();
        adminSim.addFeedItem("Emergency Airdrop Deployed. Resources Restocked.", { level: "Low", class: "low" }, new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), true);
    },

    // --- Network Mock ---
    mockNetworkFluctuation: function() {
        setInterval(() => {
            if(Math.random() > 0.8) {
                document.getElementById('onlineIndicator').classList.add('hidden');
                document.getElementById('offlineIndicator').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('offlineIndicator').classList.add('hidden');
                    document.getElementById('onlineIndicator').classList.remove('hidden');
                }, 10000);
            }
        }, 15000);
    }
};

// --- Admin Dashboard Simulation System ---
const adminSim = {
    incidentTypes: ["Medical Emergency", "Trapped under debris", "Fire reported", "Need Evacuation", "Flood waters rising"],
    priorities: [
        { level: "High", class: "class_high", prob: 0.3 },
        { level: "Medium", class: "class_medium", prob: 0.5 },
        { level: "Low", class: "class_low", prob: 0.2 }
    ],
    map: null,
    markers: [],

    init: function() {
        this.feedList = document.getElementById('feedList');
        this.map = L.map('adminMap').setView([20.5937, 75.8577], 13);
        
        L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(this.map);

        // Load and update real POIs for Admin
        app.loadRealPOIs(this.map);
        this.map.on('moveend', () => app.loadRealPOIs(this.map));

        for(let i=0; i<3; i++) {
            const d = new Date();
            d.setMinutes(d.getMinutes() - Math.floor(Math.random()*10));
            this.addFeedItem(this.getRandomItem(this.incidentTypes), this.getPriority(), d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
            this.addMapMarker();
        }
        this.simulateIncoming();
    },

    locateUserAndScan: function() {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        const btn = document.querySelector('.map-overlay-btn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Move map and drop marker
                this.map.flyTo([lat, lng], 14);
                this.addMapMarker(true, [lat, lng], 'sos');
                
                // Scan for real-world stations
                app.loadRealPOIs(this.map);
                
                btn.innerHTML = '<i class="fas fa-crosshairs"></i> Locate & Scan';
                alert(`Location found! Scanning emergency stations within 25km.`);
            },
            () => {
                btn.innerHTML = '<i class="fas fa-crosshairs"></i> Locate & Scan';
                alert("Unable to retrieve your location.");
            }
        );
    },

    getRandomItem: function(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    getPriority: function() {
        const rand = Math.random();
        let cum = 0;
        for (const p of this.priorities) { cum += p.prob; if (rand <= cum) return p; }
        return this.priorities[1];
    },

    addFeedItem: function(type, priority, timeStr, isCurrentUser = false) {
        if(!this.feedList) return;
        const item = document.createElement('div');
        item.className = 'feed-item';
        if (isCurrentUser) {
            item.style.border = "1px solid var(--accent-danger)";
            item.style.background = "rgba(239, 68, 68, 0.1)";
        }
        let badgeClass = priority.class.replace("class_", "");
        item.innerHTML = `
            <div class="feed-item-header">
                <span class="ai-badge ${badgeClass}">AI: ${priority.level}</span>
                <span class="time">${timeStr}</span>
            </div>
            <div class="feed-item-body">
                ${isCurrentUser ? '<b>[YOU]</b> ' : ''}${type}
            </div>
        `;
        this.feedList.prepend(item);
        if (this.feedList.children.length > 10) this.feedList.removeChild(this.feedList.lastChild);
    },

    addMapMarker: function(isCurrentUser = false, coords = null, type = 'default') {
        if(!this.map) return;
        if (!coords) {
            const lat = 20.5937 + (Math.random() - 0.5) * 0.1;
            const lng = 75.8577 + (Math.random() - 0.5) * 0.1;
            coords = [lat, lng];
        }

        let color = '#ef4444'; // Red default
        if (isCurrentUser) color = '#ffffff';
        if (type === 'volunteer') color = '#3b82f6'; // Blue
        if (type === 'sos') color = '#ffffff';

        const circle = L.circleMarker(coords, { color: color, fillColor: color, fillOpacity: 0.8, radius: isCurrentUser ? 10 : 6 }).addTo(this.map);
        
        if (type === 'volunteer') circle.bindPopup("Volunteer Available");
        else if (isCurrentUser) circle.bindPopup("<b>Your Location</b>").openPopup();

        this.markers.push(circle);
        if (this.markers.length > 20) {
            this.map.removeLayer(this.markers[0]);
            this.markers.shift();
        }
    },

    simulateIncoming: function() {
        setTimeout(() => {
            const d = new Date();
            const incident = this.getRandomItem(this.incidentTypes);
            this.addFeedItem(incident, this.getPriority(), d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
            this.addMapMarker();
            app.depleteResource(incident); // Deplete based on incident
            this.simulateIncoming();
        }, 6000 + Math.random() * 8000);
    }
};

// --- Boot Sequence ---
document.addEventListener('DOMContentLoaded', () => {
    adminSim.init();
    app.initMobileMap();
    app.mockNetworkFluctuation();
    app.makeFabDraggable();
    
    setTimeout(() => { app.navigate('login'); }, 2000);
});
