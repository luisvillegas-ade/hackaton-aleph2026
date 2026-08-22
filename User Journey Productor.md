This sequence focuses strictly on your defined scope: pushing the `.als` and master `.wav` to the node, receiving auto-routed stems, and browsing a performer's private repository.
### Step 1: Committing and Broadcasting

The Producer has finished working in Ableton, exported a master WAV for the performers, and returns to the terminal to push the update.


```
┌────────────────────────────────────────────────────────────────────────┐
│ [ PEARS AUDIO SYNC ] | ROLE: PRODUCER | NODE: ONLINE (3 PEERS)         │
├────────────────────────────────────────────────────────────────────────┤
│ PROJECT: ~/Music/Ableton/Track_Alpha_Project                           │
│ CURRENT HEAD: V1.3.0                                                   │
│                                                                        │
│ PENDING CHANGES DETECTED:                                              │
│ > Modified: Track_Alpha.als                                            │
│ > New File: /Exports/Master_Bounce_V1.4.wav                            │
│                                                                        │
│ COMMANDS:                                                              │
│ [P] Push changes to P2P Node                                           │
│ [D] Discard local changes                                              │
│                                                                        │
│ SYSTEM PROMPT:                                                         │
│ Commit changes as V1.4.0 and broadcast Master_Bounce_V1.4.wav to       │
│ performers? (Y/N): Y_                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 2: The Auto-Routed Inbox

Later, while the Producer is working, a Performer (e.g., the Guitarist) pushes a completed stem. The terminal notifies the Producer that the file has been securely received and automatically routed into the Ableton project structure.
```
┌────────────────────────────────────────────────────────────────────────┐
│ [ PEARS AUDIO SYNC ] | ACTIVITY MONITOR                                │
├────────────────────────────────────────────────────────────────────────┤
│ [14:02:16] SUCCESS: Version 1.4.0 synced to Pears node.                │
│ [14:05:00] WAITING: Listening for peer connections...                  │
│                                                                        │
│ [15:45:10] INCOMING: Push received from [Node: Guitarist].             │
│                                                                        │
│ AUTO-ROUTING STATUS:                                                   │
│ └─ Guitar_Solo_Take1.wav -> ~/Samples/Guitar/ (SUCCESS)                │
│                                                                        │
│ SYSTEM NOTICE:                                                         │
│ File routed to active project directory. Switch to Ableton Live to     │
│ preview. No .als modifications occurred.                               │
│                                                                        │
│ COMMANDS:                                                              │
│ [R] Refresh Log | [B] Browse Performer Repositories                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 3: Browsing a Performer's Repository

The Producer needs a specific outtake that the Performer recorded but didn't actively push to the master project. The Producer accesses the Performer's shared P2P directory to pull it manually.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [ PEARS AUDIO SYNC ] | REPOSITORY EXPLORER                             │
├────────────────────────────────────────────────────────────────────────┤
│ CONNECTED PEER REPOSITORIES:                                           │
│ > [1] Guitarist_Storage (Access: Granted)                              │
│   [2] Vocals_Storage (Access: Granted)                                 │
│                                                                        │
│ DIRECTORY: /Guitarist_Storage/Raw_Ideas_Weekend/                       │
│   ├── solo_idea_A.wav (24MB)                                           │
│   ├── solo_idea_B_alt.wav (26MB)  <-- [SELECTED]                       │
│   └── bridge_chords.wav (15MB)                                         │
│                                                                        │
│ COMMANDS:                                                              │
│ [I] Import selected to Ableton /Samples/ folder                        │
│ [P] Preview Hash Data                                                  │
│ [Esc] Return to Dashboard                                              │
└────────────────────────────────────────────────────────────────────────┘
```