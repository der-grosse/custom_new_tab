const listStartingStrings = [
  "- ",
  "* ",
  ". ",
  "~ ",
  "° ",
  "-",
  "*",
  ".",
  "~",
  "°",
];

async function notepadInit() {
  let { notes, showNotes } = await getStorageValue(["notes", "showNotes"]);

  const noteTemplate = document.getElementById("note_template");
  const wrapper = document.getElementById("notepad");
  const addNoteButton = document.getElementById("add_note");

  const setStorageNotes = debounce(
    () => setStorageValue({ notes }),
    1000,
    1000
  );

  function setNotesVisibility() {
    if (!showNotes) wrapper.style.display = null;
    else wrapper.style.display = "initial";
  }

  function getNewId() {
    let newid = 0;
    while (notes.some(({ id }) => newid === id)) newid++;
    return newid;
  }

  // value to prevent input eventListener to overwrite changes from keydown listener
  // counts for currently focused input
  let preventTextfieldSave = false;
  // id of  focused note
  let focused = -1;

  // creates DOM elements from notes value
  // inits visibility of notes
  // add eventlistener to add note button
  function initNotes() {
    setNotesVisibility();

    notes.forEach(({ note, id }) => {
      addNote(id, note);
    });

    addNoteButton.addEventListener("click", () => {
      const emptyNote = notes.find((note) => !note.note && !note.title);
      if (emptyNote) {
        // if an empty note exists, focus title of empty note instead of creating new one
        wrapper
          .querySelector(`.note[noteid="${emptyNote.id}"]`)
          .querySelector("input")
          .focus();
      } else {
        const id = getNewId();
        notes.push({ id, note: "", title: "" });
        setStorageValue({ notes });
      }
    });

    window.addEventListener("beforeunload", () => setStorageValue({ notes }));
  }

  // updates DOM and textarea values from current notes value
  function updateNotes() {
    const mounted = [...wrapper.querySelectorAll(".note:not(#add_note)")].map(
      (ele) => ({
        id: getId(ele),
        textarea: ele.querySelector("textarea"),
        input: ele.querySelector("input"),
        ele,
      })
    );

    // update existing and add new
    notes.forEach(({ note, title, id }) => {
      const current = mounted.find((ele) => ele.id === id);
      // update current textfield
      if (current) {
        // don't update focused to not mess up cursor position and tabbing out blurs and sets focused to -1
        if (
          (current.textarea.value !== note || current.input.value !== title) &&
          id !== focused
        ) {
          current.textarea.value = note;
          resizeTextarea(current.textarea);

          current.input.value = title || "";
        }
        // add new notes
      } else addNote(id, note);
    });

    // removed notes
    mounted
      .filter((ele) => !notes.some((note) => note.id === ele.id))
      .forEach((note) => {
        note.ele.remove();
      });
  }

  // resize textarea to correct height to not scroll
  function resizeTextarea(textarea) {
    // update height of textarea
    textarea.style.height = "0";
    textarea.style.height = textarea.scrollHeight + "px";
    // when deleting everything at once
    requestAnimationFrame(() => {
      textarea.style.height = "0";
      textarea.style.height = textarea.scrollHeight + "px";
    });
  }

  // get id of a note DOM element
  function getId(element) {
    return Number(element.getAttribute("noteid"));
  }

  // adds a note DOM element with eventlisteners
  function addNote(id, note = "", title = "", autofocus = false) {
    const element = noteTemplate.content.cloneNode(true).children[0];
    const textarea = element.querySelector("textarea");
    const input = element.querySelector("input");
    element.setAttribute("noteid", id);
    textarea.addEventListener("focus", () => {
      preventTextfieldSave = false;
      focused = getId(element);
    });
    textarea.addEventListener("blur", (e) => {
      preventTextfieldSave = false;
      // switch from note textarea to title input
      if (e.relatedTarget === input) return;
      focused = -1;
      if (textarea.value === "" && input.value === "" && notes.length > 1) {
        deleteNote(getId(element));
      }
    });
    // update storage on change
    textarea.addEventListener("input", () => {
      if (preventTextfieldSave) return (preventTextfieldSave = false);
      const eleId = getId(element);
      notes.find(({ id }) => id == eleId).note = textarea.value;
      resizeTextarea(textarea);
      setStorageNotes();
    });
    // eventListener for enter key to possibly add a dash to the next line
    textarea.addEventListener("keydown", (e) => {
      // tab presses to indent or dedent lines if they are lists
      // enter with list start creates new list entry
      if (!["Tab", "Enter"].includes(e.key)) return;

      if (e.key === "Enter") {
        // when ctrl is pressed either move to next note or create new
        if (e.ctrlKey) {
          // get note under current
          const nextNote = notes.reduce((cur, note) => {
            if (note.id <= id) return cur;
            if (note.id > (cur ? cur.id : Infinity)) return cur;
            return note;
          }, null);
          // is not last note
          if (nextNote) {
            wrapper
              .querySelector(`.note[noteid="${nextNote.id}"] input`)
              .focus();
            return;
          } else {
            // only create new note if user is at last note
            // don't make new note if current is empty and would be deleted
            if (textarea.value === "" && input.value === "") return;
            const id = getNewId();
            notes.push({ id, note: "", title: "" });
            addNote(id, "", "", true);
            setStorageValue({ notes });
            return;
          }
        }
        if (e.shiftKey) return;
      }

      const lines = textarea.value.split("\n");
      let temp = textarea.selectionStart;
      const currentLineIndex = lines.findIndex((line) => {
        if (line.length >= temp) return true;
        temp -= line.length + 1;
        return false;
      });
      const currentLine =
        currentLineIndex === -1 ? "" : lines[currentLineIndex];

      const trimmedCurrentLine = currentLine.trimStart();
      const hasSpace = trimmedCurrentLine.match(/[1-9][0-9]*\.\s/) !== null;
      const numberedList = trimmedCurrentLine.match(/[1-9][0-9]*\./)?.["0"];
      const listStartString =
        numberedList ||
        listStartingStrings.find((str) => trimmedCurrentLine.startsWith(str));
      // current line is part of a list
      if (listStartString) {
        let newValue = "";
        let selectionStart = 0;
        let selectionEnd = 0;

        if (e.key === "Tab") {
          // trying to dedent with not indetation
          if (currentLine.length - trimmedCurrentLine.length < 2 && e.shiftKey)
            return;

          e.preventDefault();
          preventTextfieldSave = true;

          newValue = lines
            .slice(0, currentLineIndex)
            .concat(
              [e.shiftKey ? currentLine.slice(2) : " ".repeat(2) + currentLine],
              lines.slice(currentLineIndex + 1)
            )
            .join("\n");

          selectionStart = textarea.selectionStart + (e.shiftKey ? -2 : 2);
          selectionEnd = textarea.selectionEnd + (e.shiftKey ? -2 : 2);
        } else if (e.key === "Enter") {
          // only set enter true if value gets changed by this listener
          preventTextfieldSave = true;
          e.preventDefault();

          const indentLength = currentLine.length - trimmedCurrentLine.length;

          let newListStartString = listStartString;
          if (numberedList) {
            newListStartString =
              Number(listStartString.slice(0, -1)) +
              1 +
              "." +
              (hasSpace ? " " : "");
          }

          newValue = lines
            .slice(0, currentLineIndex)
            .concat(
              [
                currentLine.slice(0, temp),
                " ".repeat(indentLength) +
                  newListStartString +
                  currentLine.slice(temp),
              ],
              !numberedList
                ? lines.slice(currentLineIndex + 1)
                : incrementNumberedList(lines.slice(currentLineIndex + 1))
            )
            .join("\n");

          selectionStart =
            // current position + indetation + list string + new line
            textarea.selectionStart +
            indentLength +
            newListStartString.length +
            1;
          selectionEnd =
            textarea.selectionEnd +
            indentLength +
            newListStartString.length +
            1;
        }

        const eleId = getId(element);
        notes.find(({ id }) => id == eleId).note = newValue;

        setStorageNotes();

        textarea.value = newValue;

        resizeTextarea(textarea);

        requestAnimationFrame(() => {
          textarea.selectionEnd = selectionEnd;
          textarea.selectionStart = selectionStart;
        });
      }
    });
    // changed focused when focusing / bluring title of note
    input.addEventListener("focus", () => {
      focused = getId(element);
    });
    input.addEventListener("blur", (e) => {
      // switch from title input to note textarea
      if (e.relatedTarget === textarea) return;
      focused = -1;
      if (textarea.value === "" && input.value === "" && notes.length > 1) {
        deleteNote(getId(element));
      }
    });
    // focus textarea on title enter keypress
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      textarea.focus();
    });
    // update title storage value
    input.addEventListener("input", () => {
      const eleId = getId(element);
      notes.find(({ id }) => id == eleId).title = input.value;
      setStorageNotes();
    });

    const existingNote = notes.find((note) => note.id === id);
    textarea.value = note || existingNote ? existingNote.note : "";
    // title can be undefined since it was added with version 1.3.4
    input.value = title || existingNote ? existingNote.title || "" : "";
    textarea.style.height = "0";
    requestAnimationFrame(() => {
      textarea.style.height = textarea.scrollHeight + "px";
    });

    wrapper.insertBefore(element, addNoteButton);

    if (autofocus)
      requestAnimationFrame(() => {
        input.focus();
      });
  }

  // deletes a node from notes and updates storage
  function deleteNote(id) {
    const index = notes.findIndex((note) => note.id === id);
    if (index === -1) return;
    notes.splice(index, 1);
    setStorageValue({ notes });
  }

  function incrementNumberedList(lines) {
    let listEnded = false;
    return lines.map((line) => {
      if (listEnded) return line;
      const start = line.match(/[1-9][0-9]*\./)?.["0"];
      if (!start) {
        listEnded = true;
        return line;
      }
      line =
        " ".repeat(line.length - line.trimStart().length) +
        (Number(start.slice(0, -1)) + 1) +
        "." +
        line.trimStart().slice(start.length);

      return line;
    });
  }

  // global change listener
  changeListener.push((changes) => {
    if (changes.notes !== undefined) {
      notes = changes.notes.newValue;
      updateNotes();
    }
    if (changes.showNotes !== undefined) {
      if (showNotes !== changes.showNotes.newValue) {
        showNotes = changes.showNotes.newValue;
        setNotesVisibility();
      }
    }
  });

  initNotes();
}

notepadInit();
