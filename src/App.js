import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { abi } from './contractABI';

function App() {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionInfo, setConnectionInfo] = useState({});
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [account, setAccount] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (!process.env.REACT_APP_RPC || !process.env.REACT_APP_CONTRACT_ADDRESS) {
          throw new Error("Missing environment variables");
        }

        const provider = new ethers.JsonRpcProvider(process.env.REACT_APP_RPC);
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();

        // Check if already connected to MetaMask
        if (window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            // Use MetaMask provider to get tasks
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(process.env.REACT_APP_CONTRACT_ADDRESS, abi, provider);
            const tasks = await contract.getTasks();
            setTasks(tasks);
          }
        }

        setConnectionInfo({
          network: network.name,
          chainId: Number(network.chainId),
          blockNumber: Number(blockNumber),
          contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask");
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      setError(null);

      // Switch to Calibration testnet if not already on it
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x4CB2F' }], // 314159 in hex
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x4CB2F',
              chainName: 'Filecoin - Calibration testnet',
              nativeCurrency: { name: 'tFIL', symbol: 'tFIL', decimals: 18 },
              rpcUrls: ['https://api.calibration.node.glif.io/rpc/v1'],
              blockExplorerUrls: ['https://calibration.filscan.io']
            }]
          });
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
    }
  };

  const createTask = async () => {
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask");
      if (!account) throw new Error("Please connect your wallet first");
      if (!newTaskText.trim()) throw new Error("Task description cannot be empty");

      setIsCreating(true);
      setError("Waiting for MetaMask confirmation...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(process.env.REACT_APP_CONTRACT_ADDRESS, abi, signer);

      console.log("Creating task with:", {
        description: newTaskText,
        contract: process.env.REACT_APP_CONTRACT_ADDRESS,
        signer: await signer.getAddress()
      });

      const tx = await contract.createTask(newTaskText);
      setError("Transaction submitted. Waiting for confirmation...");

      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Refresh tasks
      const tasks = await contract.getTasks();
      setTasks(tasks);
      setNewTaskText('');
      setError(null);
    } catch (err) {
      console.error('Task creation error:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTask = async (taskId) => {
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask");
      if (!account) throw new Error("Please connect your wallet first");

      setError("Toggling task... Please confirm in MetaMask");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(process.env.REACT_APP_CONTRACT_ADDRESS, abi, signer);

      const tx = await contract.toggleComplete(taskId);
      setError("Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      // Refresh tasks
      const tasks = await contract.getTasks();
      setTasks(tasks);
      setError(null);
    } catch (err) {
      console.error('Toggle task error:', err);
      setError(`Error: ${err.message}`);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      if (!window.ethereum) throw new Error("Please install MetaMask");
      if (!account) throw new Error("Please connect your wallet first");

      setError("Deleting task... Please confirm in MetaMask");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(process.env.REACT_APP_CONTRACT_ADDRESS, abi, signer);

      const tx = await contract.deleteTask(taskId);
      setError("Transaction submitted. Waiting for confirmation...");
      await tx.wait();

      // Refresh tasks
      const tasks = await contract.getTasks();
      setTasks(tasks);
      setError(null);
    } catch (err) {
      console.error('Delete task error:', err);
      setError(`Error: ${err.message}`);
    }
  };

  if (isLoading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>📝 Decentralized Todo List</h1>

      <div style={{ marginBottom: 20 }}>
        <h3>Connection Info:</h3>
        <pre>{JSON.stringify(connectionInfo, null, 2)}</pre>
      </div>

      {error && (
        <div style={{ color: isCreating ? 'blue' : 'red', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {!account ? (
        <button
          onClick={connectWallet}
          style={{ padding: '8px 16px', marginBottom: 20 }}
        >
          Connect Wallet
        </button>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Enter new task"
              style={{ padding: '8px', marginRight: '8px' }}
              disabled={isCreating}
            />
            <button
              onClick={createTask}
              style={{ padding: '8px 16px' }}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Add Task'}
            </button>
          </div>
        </div>
      )}

      <div>
        <h3>Tasks:</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {tasks.map((task, index) => (
            <li
              key={task.id || index}
              style={{
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px'
              }}
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                style={{ marginRight: '8px', cursor: 'pointer' }}
              />
              <span style={{
                textDecoration: task.completed ? 'line-through' : 'none',
                color: task.completed ? '#666' : '#000',
                flex: 1
              }}>
                {task.description}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                style={{
                  backgroundColor: '#ff4444',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginLeft: '8px'
                }}
              >
                Delete
              </button>
            </li>
          ))}
          {tasks.length === 0 && (
            <li style={{ color: '#666', fontStyle: 'italic' }}>No tasks yet. Add your first task above!</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default App;
