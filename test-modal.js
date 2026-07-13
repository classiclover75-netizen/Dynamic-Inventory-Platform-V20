let state = { isOpen: true, title: "1" };
const setConfirmationModal = (update) => {
  if (typeof update === 'function') {
    state = update(state);
  } else {
    state = update;
  }
};

const onClick = () => {
  // Simulating first onConfirm
  const onConfirm1 = () => {
    setConfirmationModal({ isOpen: true, title: "2" });
  };
  
  onConfirm1();
  setConfirmationModal(prev => ({ ...prev, isOpen: false }));
};

onClick();
console.log(state);
