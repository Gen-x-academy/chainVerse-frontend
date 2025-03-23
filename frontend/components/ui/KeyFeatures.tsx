import { Wallet, CircleDollarSign, BadgeIcon as Certificate } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"

export default function KeyFeatures() {


    const keyFeatures = [
        {
            icon: <CircleDollarSign className="w-12 h-12" />,
            title: "Crypto Payments",
            Content: " Pay for courses using Stellar-based tokens like XLM and USDC with fast, low-cost transactions.",
            color: "text-blue-600 "
        },
        {
          icon:  <Wallet className="w-12 h-12" />,
          title: "Web3 Wallet Integration",
          Content: "            Connect your Stellar wallet (Lobstr, Freighter, Rabet) for seamless payments and certification tracking.",
          color: "text-purple-600"
      },
      {
        icon: <Certificate className="w-12 h-12" />,
        title: "NFT Certifications",
        Content: "Receive verifiable NFT certificates stored on Stellar's blockchain upon course completion.",
        color: "text-cyan-500 "
    }
    ]





  return (
    <section className="w-full mx-auto px-[10%] py-[5%] bg-gray-50 ">




      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-2">Key Features</h2>
        <p className="text-gray-600">Learn with the power of blockchain technology</p>
      </div>


      <div className=" flex flex-col lg:flex-row gap-6 items-center justify-center ">



{
  keyFeatures.map((feature, index) => (
    <Card key={index} className=" bg-white cursor-pointer   py-6 px-2 flex flex-col items-center text-center gap-2 hover:border-1 hover:border-blue-600 "  >
      <CardHeader className="w-full flex items-center justify-center m-0  " >
        <CardTitle className="flex items-center justify-center flex-col" >

          <span    className= {` ${feature.color} mb-2 `} >{feature.icon}</span>

        <span className="text-xl font-bold leading-[18px]  "  >{feature.title} </span>

          </CardTitle>
      </CardHeader>
      <CardContent className="w-full px-2 " >
        <p className="text-gray-600  " >{feature.Content} </p>
      </CardContent>

    </Card>
  ))
}




      </div>



    </section>
  )
}

