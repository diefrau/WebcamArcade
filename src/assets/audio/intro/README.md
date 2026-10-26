# Intro voice assets — deferred

The user chose sound effects first. No spoken audio, browser TTS or fake voice
files are shipped in this version.

When crowd recordings are supplied, use the following names for each locale:
ko/ready.mp3, ko/three.mp3, ko/two.mp3, ko/one.mp3, ko/go.mp3 and matching en/
files. Mix and normalize the crowd layers offline; register the finished samples
in the existing SoundManager and trigger them from the existing intro beat
callback. That callback follows the same visible phase as the typography.
Keep countdown recordings shorter than each 550ms beat; do not add a second
independent voice timer or let a late download replay an expired cue.
