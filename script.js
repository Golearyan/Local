/* ==========================================================================
   STUDENT REGISTRATION SYSTEM - JAVASCRIPT (script.js)
   --------------------------------------------------------------------------
   This script handles all dynamic behavior:
   1. Form validation and error messages.
   2. Saving, reading, editing, and deleting student records.
   3. Persistent storage using the browser's localStorage.
   4. Live search, course filtering, and sorting.
   5. Data export (CSV & JSON) and demo data loading.
   6. Custom UI feedback (Toasts & Confirmation Modal).
   ========================================================================== */

// Use strict mode for cleaner code and catching common mistakes early
"use strict";

/* --------------------------------------------------------------------------
   1. CONSTANTS & DOM SELECTORS
   --------------------------------------------------------------------------
   We store key DOM elements in variables so we don't have to query the document repeatedly.
*/
const STORAGE_KEY = "student_portal_records"; // Key name used inside localStorage

// Form elements
const studentForm = document.getElementById("studentForm");
const editStudentId = document.getElementById("editStudentId");
const studentNameInput = document.getElementById("studentName");
const studentCourseSelect = document.getElementById("studentCourse");
const studentAddressTextarea = document.getElementById("studentAddress");
const submitBtn = document.getElementById("submitBtn");
const submitBtnText = document.getElementById("submitBtnText");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const resetBtn = document.getElementById("resetBtn");
const formHeading = document.getElementById("formHeading");
const formModeBadge = document.getElementById("formModeBadge");

// Inline error message elements
const nameError = document.getElementById("nameError");
const genderError = document.getElementById("genderError");
const courseError = document.getElementById("courseError");
const addressError = document.getElementById("addressError");

// Table & display elements
const studentTableBody = document.getElementById("studentTableBody");
const totalCountDisplay = document.getElementById("totalCount");
const emptyStateContainer = document.getElementById("emptyState");

// Search, Filter & Sort elements
const searchInput = document.getElementById("searchInput");
const courseFilter = document.getElementById("courseFilter");
const sortBy = document.getElementById("sortBy");

// Action buttons
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const demoDataBtn = document.getElementById("demoDataBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

// Modal elements
const confirmModal = document.getElementById("confirmModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCancelBtn = document.getElementById("modalCancelBtn");
const modalConfirmBtn = document.getElementById("modalConfirmBtn");

// Toast container
const toastContainer = document.getElementById("toastContainer");

// In-memory state tracking which action the modal should perform when confirmed
let pendingModalAction = null;

/* --------------------------------------------------------------------------
   2. INITIALIZATION
   --------------------------------------------------------------------------
   Runs automatically when the page finishes loading.
*/
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initial render of any records saved in localStorage
    renderStudents();

    // 2. Attach form submission and reset listeners
    studentForm.addEventListener("submit", handleFormSubmit);
    resetBtn.addEventListener("click", handleFormReset);
    cancelEditBtn.addEventListener("click", cancelEditMode);

    // 3. Attach search and filter real-time listeners
    searchInput.addEventListener("input", renderStudents);
    courseFilter.addEventListener("change", renderStudents);
    sortBy.addEventListener("change", renderStudents);

    // 4. Attach utility button listeners
    exportCsvBtn.addEventListener("click", exportToCsv);
    exportJsonBtn.addEventListener("click", exportToJson);
    demoDataBtn.addEventListener("click", loadDemoData);
    clearAllBtn.addEventListener("click", promptClearAll);

    // 5. Attach confirmation modal listeners
    modalCancelBtn.addEventListener("click", closeModal);
    modalConfirmBtn.addEventListener("click", executeModalAction);

    // Close modal if user clicks on the darkened backdrop outside the box
    confirmModal.addEventListener("click", (e) => {
        if (e.target === confirmModal) {
            closeModal();
        }
    });

    // 6. Event delegation for Table Actions (Edit & Delete buttons)
    // Instead of multiple inline listeners, one listener handles all rows cleanly
    studentTableBody.addEventListener("click", (event) => {
        const editButton = event.target.closest(".edit-btn");
        const deleteButton = event.target.closest(".delete-btn");

        if (editButton) {
            const studentId = editButton.getAttribute("data-id");
            if (studentId) startEditStudent(studentId);
        } else if (deleteButton) {
            const studentId = deleteButton.getAttribute("data-id");
            if (studentId) promptDeleteStudent(studentId);
        }
    });

    // 7. Real-time validation clearance as user types or selects
    studentNameInput.addEventListener("input", () => clearFieldError(nameError));
    studentCourseSelect.addEventListener("change", () => clearFieldError(courseError));
    studentAddressTextarea.addEventListener("input", () => clearFieldError(addressError));
    document.querySelectorAll('input[name="gender"]').forEach(radio => {
        radio.addEventListener("change", () => clearFieldError(genderError));
    });
});

/* --------------------------------------------------------------------------
   3. STORAGE FUNCTIONS (LOCALSTORAGE)
   --------------------------------------------------------------------------
   Safely saves and loads records to/from the user's browser localStorage.
*/

/**
 * Retrieves the array of students from localStorage.
 * If data is missing or corrupted, returns an empty array safely without breaking.
 * @returns {Array} Array of student objects
 */
function getStoredStudents() {
    try {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (!rawData) return [];
        const parsed = JSON.parse(rawData);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Error reading from localStorage:", error);
        showToast("Storage error: Failed to parse saved records.", "danger");
        return [];
    }
}

/**
 * Saves the given array of students to localStorage.
 * @param {Array} students - Array of student records
 */
function saveStoredStudents(students) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch (error) {
        console.error("Error saving to localStorage:", error);
        showToast("Failed to save data. Browser storage might be full or disabled.", "danger");
    }
}

/* --------------------------------------------------------------------------
   4. FORM SUBMISSION & VALIDATION
   --------------------------------------------------------------------------
*/

/**
 * Handles the submit event when the user clicks 'Submit' or 'Update'.
 * @param {Event} e 
 */
function handleFormSubmit(e) {
    // Prevent the default browser behavior of refreshing or navigating away
    e.preventDefault();

    // Clear any previous error messages
    clearAllErrors();

    // Collect values from the form inputs
    const name = studentNameInput.value.trim();
    const course = studentCourseSelect.value.trim();
    const address = studentAddressTextarea.value.trim();
    
    // Find whichever gender radio button is checked (if any)
    const selectedGenderRadio = document.querySelector('input[name="gender"]:checked');
    const gender = selectedGenderRadio ? selectedGenderRadio.value : "";

    // Validate inputs step-by-step
    let isValid = true;

    if (!name) {
        showFieldError(nameError, "Please enter student's full name.");
        isValid = false;
    } else if (name.length < 2) {
        showFieldError(nameError, "Name must be at least 2 characters long.");
        isValid = false;
    }

    if (!gender) {
        showFieldError(genderError, "Please select a gender option.");
        isValid = false;
    }

    if (!course) {
        showFieldError(courseError, "Please choose a course.");
        isValid = false;
    }

    if (!address) {
        showFieldError(addressError, "Please enter an address.");
        isValid = false;
    } else if (address.length < 5) {
        showFieldError(addressError, "Address must be at least 5 characters long.");
        isValid = false;
    }

    // Stop execution if any field failed validation
    if (!isValid) return;

    // Check if we are UPDATING an existing student or ADDING a new one
    const currentId = editStudentId.value;
    const students = getStoredStudents();

    if (currentId) {
        // --- EDIT MODE ---
        const studentIndex = students.findIndex(s => s.id === currentId);
        if (studentIndex !== -1) {
            students[studentIndex] = {
                ...students[studentIndex],
                name: name,
                gender: gender,
                course: course,
                address: address,
                updatedAt: new Date().toISOString()
            };
            saveStoredStudents(students);
            showToast(`Record for "${name}" updated successfully!`, "success");
        } else {
            showToast("Student not found. It may have been deleted.", "danger");
        }
        cancelEditMode();
    } else {
        // --- CREATE MODE ---
        const newStudent = {
            id: "STU-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 1000),
            name: name,
            gender: gender,
            course: course,
            address: address,
            createdAt: new Date().toISOString()
        };

        students.unshift(newStudent); // Place the newest student at the beginning
        saveStoredStudents(students);
        showToast(`Student "${name}" registered successfully!`, "success");
        studentForm.reset();
    }

    // Re-render the table with updated data
    renderStudents();
}

/**
 * Handles clearing the form and resetting errors.
 */
function handleFormReset() {
    clearAllErrors();
    if (editStudentId.value) {
        cancelEditMode();
    }
}

/**
 * Shows an inline error message under a specific input field.
 */
function showFieldError(element, message) {
    if (element) {
        element.textContent = message;
    }
}

/**
 * Clears an inline error message for a specific input field.
 */
function clearFieldError(element) {
    if (element) {
        element.textContent = "";
    }
}

/**
 * Clears all error messages across the form.
 */
function clearAllErrors() {
    clearFieldError(nameError);
    clearFieldError(genderError);
    clearFieldError(courseError);
    clearFieldError(addressError);
}

/* --------------------------------------------------------------------------
   5. EDIT & DELETE OPERATIONS
   --------------------------------------------------------------------------
*/

/**
 * Populates the form with existing student details for editing.
 * @param {string} id - Unique student record ID
 */
function startEditStudent(id) {
    const students = getStoredStudents();
    const student = students.find(s => s.id === id);

    if (!student) {
        showToast("Student record not found.", "danger");
        return;
    }

    // Populate inputs
    editStudentId.value = student.id;
    studentNameInput.value = student.name;
    studentCourseSelect.value = student.course;
    studentAddressTextarea.value = student.address;

    // Check matching radio button
    const radioToSelect = document.querySelector(`input[name="gender"][value="${student.gender}"]`) ||
                          document.querySelector(`input[name="gender"][value="${student.gender.toLowerCase()}"]`);
    if (radioToSelect) {
        radioToSelect.checked = true;
    }

    // Switch UI into "Edit Mode"
    formHeading.textContent = "Edit Student";
    formModeBadge.textContent = "Editing ID: " + student.id.slice(0, 8);
    formModeBadge.classList.add("edit-mode");
    submitBtnText.textContent = "Update Record";
    cancelEditBtn.classList.remove("d-none");

    // Smoothly scroll the form into view (helpful on smaller screens)
    studentForm.scrollIntoView({ behavior: "smooth", block: "start" });
    studentNameInput.focus();
}

/**
 * Cancels editing mode and reverts form back to "Create Mode".
 */
function cancelEditMode() {
    studentForm.reset();
    editStudentId.value = "";
    formHeading.textContent = "New Registration";
    formModeBadge.textContent = "Create Mode";
    formModeBadge.classList.remove("edit-mode");
    submitBtnText.textContent = "Submit";
    cancelEditBtn.classList.add("d-none");
    clearAllErrors();
}

/**
 * Prompts user confirmation before deleting a student record.
 * @param {string} id - Student ID to delete
 */
function promptDeleteStudent(id) {
    const students = getStoredStudents();
    const student = students.find(s => s.id === id);
    const studentName = student ? student.name : "this student";

    openModal(
        "Delete Student Record",
        `Are you sure you want to delete the record for "${studentName}"? This action cannot be undone.`,
        () => {
            deleteStudent(id);
        }
    );
}

/**
 * Deletes student from localStorage by ID and updates the UI.
 * @param {string} id 
 */
function deleteStudent(id) {
    let students = getStoredStudents();
    const initialLength = students.length;
    students = students.filter(s => s.id !== id);

    if (students.length < initialLength) {
        saveStoredStudents(students);
        showToast("Student record deleted successfully.", "info");
        
        // If the currently edited record was deleted, reset the form
        if (editStudentId.value === id) {
            cancelEditMode();
        }

        renderStudents();
    }
}

/**
 * Prompts user before clearing ALL records.
 */
function promptClearAll() {
    const students = getStoredStudents();
    if (students.length === 0) {
        showToast("There are no records to clear.", "info");
        return;
    }

    openModal(
        "Clear All Student Records",
        `Warning: You are about to permanently delete all ${students.length} student records from your browser storage. Do you wish to continue?`,
        () => {
            localStorage.removeItem(STORAGE_KEY);
            cancelEditMode();
            renderStudents();
            showToast("All records have been cleared.", "info");
        }
    );
}

/* --------------------------------------------------------------------------
   6. RENDERING & FILTERING
   --------------------------------------------------------------------------
   Builds the HTML table rows dynamically based on the current records,
   search query, course filter, and sort order.
*/

function renderStudents() {
    const allStudents = getStoredStudents();

    // 1. Update overall counter badge in the header
    totalCountDisplay.textContent = allStudents.length;

    // 2. Read filter and search criteria
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCourse = courseFilter.value;
    const currentSort = sortBy.value;

    // 3. Filter records
    let filteredStudents = allStudents.filter(student => {
        // Match Search Query (Name or Address)
        const nameMatches = student.name.toLowerCase().includes(searchTerm);
        const addressMatches = student.address.toLowerCase().includes(searchTerm);
        const matchesSearch = !searchTerm || nameMatches || addressMatches;

        // Match Course Filter
        const matchesCourse = selectedCourse === "ALL" || student.course === selectedCourse;

        return matchesSearch && matchesCourse;
    });

    // 4. Sort filtered records
    filteredStudents.sort((a, b) => {
        if (currentSort === "newest") {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        } else if (currentSort === "oldest") {
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        } else if (currentSort === "nameAsc") {
            return a.name.localeCompare(b.name);
        } else if (currentSort === "nameDesc") {
            return b.name.localeCompare(a.name);
        }
        return 0;
    });

    // 5. Handle Empty State
    if (filteredStudents.length === 0) {
        studentTableBody.innerHTML = "";
        emptyStateContainer.classList.remove("d-none");
        
        const emptyMsg = document.getElementById("emptyStateMessage");
        if (allStudents.length === 0) {
            emptyMsg.textContent = 'You haven\'t added any students yet. Fill out the form or click "✨ Demo Data" to get started!';
        } else {
            emptyMsg.textContent = 'No records match your search or filter criteria. Try clearing the search box.';
        }
        return;
    }

    // Hide empty state if we have records
    emptyStateContainer.classList.add("d-none");

    // 6. Build HTML Rows Safely using text escaping to prevent XSS
    const rowsHtml = filteredStudents.map((student, index) => {
        const serialNo = index + 1;
        const formattedDate = student.createdAt 
            ? new Date(student.createdAt).toLocaleDateString("en-IN", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })
            : "N/A";

        return `
            <tr>
                <td><strong>${serialNo}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #f8fafc;">${escapeHtml(student.name)}</div>
                    <small style="color: #64748b; font-size: 0.75rem;">${escapeHtml(student.id)}</small>
                </td>
                <td>
                    <span class="gender-tag">${escapeHtml(student.gender)}</span>
                </td>
                <td>
                    <span class="course-badge course-${escapeHtml(student.course)}">
                        ${escapeHtml(student.course)}
                    </span>
                </td>
                <td style="max-width: 220px; word-break: break-word;">
                    ${escapeHtml(student.address)}
                </td>
                <td>
                    <span style="font-size: 0.8rem; color: #94a3b8;">${formattedDate}</span>
                </td>
                <td style="text-align: center;">
                    <div class="table-actions">
                        <button 
                            type="button"
                            class="action-btn edit-btn" 
                            data-id="${escapeHtml(student.id)}"
                            title="Edit this record"
                            aria-label="Edit ${escapeHtml(student.name)}"
                        >
                            ✏️ Edit
                        </button>
                        <button 
                            type="button"
                            class="action-btn delete-btn" 
                            data-id="${escapeHtml(student.id)}"
                            title="Delete this record"
                            aria-label="Delete ${escapeHtml(student.name)}"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    studentTableBody.innerHTML = rowsHtml;
}

/* --------------------------------------------------------------------------
   7. EXPORT FEATURES (CSV & JSON)
   --------------------------------------------------------------------------
   Allows the user to download client-side backups of their records.
*/

/**
 * Exports all currently saved student records as a downloadable CSV spreadsheet.
 */
function exportToCsv() {
    const students = getStoredStudents();
    if (students.length === 0) {
        showToast("No records available to export.", "info");
        return;
    }

    // CSV Header row
    const headers = ["ID", "Name", "Gender", "Course", "Address", "Created Date"];
    
    // Map records to CSV rows, wrapping values in quotes to handle commas
    const rows = students.map(s => [
        `"${s.id}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.gender || '').replace(/"/g, '""')}"`,
        `"${(s.course || '').replace(/"/g, '""')}"`,
        `"${(s.address || '').replace(/"/g, '""')}"`,
        `"${s.createdAt || ''}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    downloadFile(csvContent, "students_records.csv", "text/csv;charset=utf-8;");
    showToast("CSV file downloaded successfully!", "success");
}

/**
 * Exports all currently saved records as a raw JSON file.
 */
function exportToJson() {
    const students = getStoredStudents();
    if (students.length === 0) {
        showToast("No records available to export.", "info");
        return;
    }

    const jsonString = JSON.stringify(students, null, 2);
    downloadFile(jsonString, "students_records.json", "application/json");
    showToast("JSON file downloaded successfully!", "success");
}

/**
 * Utility helper to trigger a client-side file download via an invisible link.
 */
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* --------------------------------------------------------------------------
   8. DEMO DATA GENERATOR
   --------------------------------------------------------------------------
   Populates sample records so the user or evaluator can test features immediately.
*/
function loadDemoData() {
    const demoStudents = [
        {
            id: "STU-DEMO-001",
            name: "Aryan Sharma",
            gender: "male",
            course: "BCA",
            address: "42 MG Road, Sector 14, Gurugram, Haryana",
            createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
        },
        {
            id: "STU-DEMO-002",
            name: "Priya Patel",
            gender: "Female",
            course: "MCA",
            address: "108 Green Glen Layout, Bellandur, Bengaluru",
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
            id: "STU-DEMO-003",
            name: "Rahul Verma",
            gender: "male",
            course: "MBA",
            address: "Flat 402, Sunshine Heights, Andheri West, Mumbai",
            createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: "STU-DEMO-004",
            name: "Sneha Reddy",
            gender: "Female",
            course: "BBA",
            address: "Plot 15, Jubilee Hills, Hyderabad, Telangana",
            createdAt: new Date().toISOString()
        }
    ];

    const currentStudents = getStoredStudents();
    
    // Avoid duplicating demo students if already loaded
    const existingIds = new Set(currentStudents.map(s => s.id));
    const newItems = demoStudents.filter(d => !existingIds.has(d.id));

    if (newItems.length === 0) {
        showToast("Demo data is already loaded in your records.", "info");
        return;
    }

    const updated = [...newItems, ...currentStudents];
    saveStoredStudents(updated);
    renderStudents();
    showToast(`Loaded ${newItems.length} demo student records!`, "success");
}

/* --------------------------------------------------------------------------
   9. MODAL & TOAST NOTIFICATION HELPERS
   --------------------------------------------------------------------------
*/

/**
 * Opens custom confirmation modal dialog.
 */
function openModal(title, message, onConfirmCallback) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    pendingModalAction = onConfirmCallback;
    confirmModal.classList.remove("d-none");
}

/**
 * Closes confirmation modal.
 */
function closeModal() {
    confirmModal.classList.add("d-none");
    pendingModalAction = null;
}

/**
 * Executes confirmed modal action.
 */
function executeModalAction() {
    if (typeof pendingModalAction === "function") {
        pendingModalAction();
    }
    closeModal();
}

/**
 * Displays a non-blocking toast message at the bottom right corner of the screen.
 * @param {string} message - Message text
 * @param {"success"|"danger"|"info"} type - Visual style
 */
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const icon = type === "success" ? "✅" : (type === "danger" ? "⚠️" : "ℹ️");
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span>${icon}</span>
            <span>${escapeHtml(message)}</span>
        </div>
        <button style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1rem;" title="Close">&times;</button>
    `;

    // Close button on toast
    toast.querySelector("button").addEventListener("click", () => {
        toast.remove();
    });

    toastContainer.appendChild(toast);

    // Auto-remove toast after 3.5 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Helper to escape HTML characters and prevent Cross-Site Scripting (XSS).
 * @param {string} unsafeString 
 * @returns {string} Sanitized string
 */
function escapeHtml(unsafeString) {
    if (unsafeString === undefined || unsafeString === null) return "";
    return String(unsafeString)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Expose functions to window as fallback if called elsewhere
window.startEditStudent = startEditStudent;
window.promptDeleteStudent = promptDeleteStudent;
