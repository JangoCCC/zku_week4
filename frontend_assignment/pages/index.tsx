import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, utils, Contract } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form"
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import {useEffect} from "react"


export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    // The greeting variable is assigned as the user's input and passed to the contract Greet method.
    var [greeting, setGreeting] = React.useState("")
    // The onChainMessage variable is assigned when the NewGreeting event is catched by useEffect below.
    var [onChainMessage, setOnChainMessage] = React.useState("")

    useEffect(() => {
        const provider1 = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider1.getSigner())

        // listen event and setOnChainMessage to display the message to the users
        contract.on("NewGreeting", (m) => {
            const message = utils.parseBytes32String(m)
            console.log("Greet message:" + message);
            setOnChainMessage(message)
        })
    }, [])

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }
    
    // Yup input validation for name, age and address
    const schema = yup.object({
        name: yup.string().required().typeError("Please enter a valid name"),
        age: yup.number().min(0, "Minimum at least 0").max(100, "Allowed maximum is 100").required().typeError("Please enter a valid age"),
        address: yup.string().matches(/^0x[a-f0-9]{40}$/i, "Please input valid blochchain address").required().typeError("Please enter a valid address")
      }).required();
      
    const { register, handleSubmit, formState:{ errors } } = useForm({
        resolver: yupResolver(schema)
      });
    // log the input in JSON format in the console
    const onSubmit = (data: any) => console.log(JSON.stringify(data));
    
    // Codes commented out below is used for Part3 Q2.1 Q2.2
    /*
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <form onSubmit={handleSubmit(onSubmit)}>
                <div>
                    <label>Name</label>
                    <input placeholder="Please input your name" {...register("name")} />
                    <p>{errors.name?.message}</p>
                </div>
                <div>
                    <label>Age</label>
                    <input placeholder="Please input your age" {...register("age")} />
                    <p>{errors.age?.message}</p>
                </div>
                <div>
                    <label>Address</label>
                    <input placeholder="Please input your address" {...register("address")} />
                    <p>{errors.address?.message}</p>
                </div>

                    <input type="submit" className={styles.button} />
                </form>
            </main>
        </div>
    )
    */
    
    // The following codes is for Part3 Q2.3
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>


                <div>
                    <input type="text" placeholder="Input your message here" value={greeting} onChange={(t) => { setGreeting(t.target.value) }}/>
                    <button onClick={() => { greet() }} className={styles.button}>
                        Greet
                    </button>

                    <body>Your greet message is:</body>
                    <body>{onChainMessage}</body>
                </div>

            </main>
        </div>
    )
}
